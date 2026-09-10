const config = require('../config/env');
const { getDb } = require('../database/db');

/**
 * Webhook para recebimento de comandas capturadas pelo Agente Spooler Balcão (Epson TM-T20)
 * POST /api/pedidos/webhook-spool
 * Header: Authorization: Bearer <BALCAO_API_SECRET>
 * Body: { origem, pedidoId, cliente, endereco, bairro, taxaEntrega, telefone, textoBruto }
 */
async function webhookSpool(req, res) {
  try {
    // 1. Autenticação via Bearer Token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    if (!token || token !== config.BALCAO_API_SECRET) {
      return res.json(401, {
        success: false,
        message: 'Unauthorized: Token de autorização do balcão inválido ou ausente.'
      });
    }

    const { origem, pedidoId, cliente, endereco, bairro, taxaEntrega, telefone, textoBruto } = req.body || {};

    if (!origem || !pedidoId) {
      return res.json(400, {
        success: false,
        message: 'Campos "origem" e "pedidoId" são obrigatórios.'
      });
    }

    const cleanOrigem = String(origem).trim().toUpperCase();
    const cleanPedidoId = String(pedidoId).trim();
    const cleanCliente = cliente ? String(cliente).trim() : null;
    const cleanEndereco = endereco ? String(endereco).trim() : null;
    const cleanBairro = bairro ? String(bairro).trim() : null;
    const cleanTelefone = telefone ? String(telefone).trim() : null;
    const cleanTextoBruto = textoBruto ? String(textoBruto).trim() : null;
    const taxa = !isNaN(Number(taxaEntrega)) ? Number(taxaEntrega) : 0.0;

    const db = getDb();

    // 2. Mecanismo Anti-Duplicação Estrito (origem + pedido_id_origem)
    const pedidoExistente = await db.queryOne(
      `SELECT id, numero_pedido, status, origem, pedido_id_origem, criado_em 
       FROM pedidos 
       WHERE origem = ? AND pedido_id_origem = ?`,
      [cleanOrigem, cleanPedidoId]
    );

    if (pedidoExistente) {
      return res.json(200, {
        success: true,
        duplicado: true,
        message: `Pedido ${cleanOrigem} #${cleanPedidoId} já registrado anteriormente.`,
        pedido: pedidoExistente
      });
    }

    // 3. Inserção do pedido com status 'disponivel' (aguardando motoboy retirar)
    const result = await db.execute(
      `INSERT INTO pedidos 
       (numero_pedido, motoboy_id, status, origem, pedido_id_origem, cliente, endereco, bairro, taxa_entrega, telefone_cliente, texto_bruto, criado_em)
       VALUES (?, NULL, 'disponivel', ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now', '-3 hours'))`,
      [cleanPedidoId, cleanOrigem, cleanPedidoId, cleanCliente, cleanEndereco, cleanBairro, taxa, cleanTelefone, cleanTextoBruto]
    );

    const novoPedidoId = Number(result.lastInsertRowid);
    const novoPedido = await db.queryOne(`SELECT * FROM pedidos WHERE id = ?`, [novoPedidoId]);

    return res.json(201, {
      success: true,
      duplicado: false,
      message: `Pedido ${cleanOrigem} #${cleanPedidoId} registrado com sucesso! Aguardando retirada.`,
      pedido: novoPedido
    });
  } catch (error) {
    console.error('❌ Erro no webhookSpool:', error);
    return res.json(500, { success: false, message: 'Erro interno ao processar webhook do spooler.', error: error.message });
  }
}

/**
 * Lista todos os pedidos disponíveis no balcão aguardando retirada por um motoboy
 * GET /api/pedidos/disponiveis
 */
async function listarPedidosDisponiveis(req, res) {
  try {
    const db = getDb();
    const pedidos = await db.query(`
      SELECT id, numero_pedido, status, origem, pedido_id_origem, cliente, endereco, bairro, taxa_entrega, telefone_cliente, criado_em,
             ROUND((julianday(DATETIME('now', '-3 hours')) - julianday(COALESCE(criado_em, DATETIME('now', '-3 hours')))) * 1440) as minutos_aguardando
      FROM pedidos
      WHERE status = 'disponivel'
      ORDER BY id DESC
    `);

    return res.json(200, {
      success: true,
      total: pedidos.length,
      pedidos: pedidos.map(p => ({
        ...p,
        taxa_entrega: Number(p.taxa_entrega || 0),
        minutos_aguardando: Math.max(0, Math.round(Number(p.minutos_aguardando || 0)))
      }))
    });
  } catch (error) {
    console.error('❌ Erro ao listar pedidos disponíveis:', error);
    return res.json(500, { success: false, message: 'Erro interno ao consultar pedidos disponíveis.', error: error.message });
  }
}

/**
 * Ação do Motoboy no Balcão: "Assumir / Retirar Pedido"
 * POST /api/pedidos/retirar
 * Body: { pedido_id, motoboy_id }
 */
async function assumirPedido(req, res) {
  try {
    const { pedido_id, motoboy_id } = req.body || {};

    if (!pedido_id || !motoboy_id) {
      return res.json(400, { success: false, message: 'Campos pedido_id e motoboy_id são obrigatórios.' });
    }

    const pedidoIdNum = Number(pedido_id);
    const motoboyIdNum = Number(motoboy_id);
    const db = getDb();

    // Atualização atômica para evitar concorrência (somente se ainda estiver 'disponivel')
    const result = await db.execute(
      `UPDATE pedidos 
       SET motoboy_id = ?, status = 'em_rota', data_inicio = DATETIME('now', '-3 hours') 
       WHERE id = ? AND status = 'disponivel'`,
      [motoboyIdNum, pedidoIdNum]
    );

    if (result.changes === 0) {
      // Verificar se já é deste mesmo motoboy
      const p = await db.queryOne(`SELECT id, motoboy_id, status FROM pedidos WHERE id = ?`, [pedidoIdNum]);
      if (p && Number(p.motoboy_id) === motoboyIdNum && p.status === 'em_rota') {
        return res.json(200, {
          success: true,
          message: 'Você já assumiu este pedido anteriormente.',
          pedido: p
        });
      }

      return res.json(409, {
        success: false,
        message: 'Este pedido já foi retirado por outro motoboy ou não está mais disponível no balcão.'
      });
    }

    // Gravar ponto inicial de GPS se o motoboy já tiver localização conhecida
    const motoboy = await db.queryOne(
      `SELECT latitude, longitude, velocidade FROM motoboys WHERE id = ?`,
      [motoboyIdNum]
    );

    if (motoboy && motoboy.latitude !== null && motoboy.longitude !== null) {
      await db.execute(
        `INSERT INTO pedido_rotas (pedido_id, motoboy_id, latitude, longitude, velocidade, criado_em) 
         VALUES (?, ?, ?, ?, ?, DATETIME('now', '-3 hours'))`,
        [pedidoIdNum, motoboyIdNum, Number(motoboy.latitude), Number(motoboy.longitude), Number(motoboy.velocidade || 0)]
      );
    }

    const pedidoAtualizado = await db.queryOne(`SELECT * FROM pedidos WHERE id = ?`, [pedidoIdNum]);

    return res.json(200, {
      success: true,
      message: `Pedido #${pedidoAtualizado.numero_pedido} retirado com sucesso! Boa rota!`,
      pedido: pedidoAtualizado
    });
  } catch (error) {
    console.error('❌ Erro ao assumir pedido:', error);
    return res.json(500, { success: false, message: 'Erro interno ao assumir pedido.', error: error.message });
  }
}

/**
 * Método legado de início manual mantido para retrocompatibilidade
 */
async function iniciarPedido(req, res) {
  try {
    const { numero_pedido, motoboy_id } = req.body || {};

    if (!numero_pedido || !motoboy_id) {
      return res.json(400, { success: false, message: 'Número do pedido e ID do motoboy são obrigatórios.' });
    }

    const numPedido = String(numero_pedido).trim();
    const motoboyIdNum = Number(motoboy_id);
    const db = getDb();

    const pedidoExistente = await db.queryOne(
      `SELECT id, motoboy_id, status FROM pedidos WHERE numero_pedido = ? AND status = 'em_rota'`,
      [numPedido]
    );

    if (pedidoExistente) {
      if (Number(pedidoExistente.motoboy_id) === motoboyIdNum) {
        return res.json(200, {
          success: true,
          message: `O pedido #${numPedido} já está em rota sob sua responsabilidade.`,
          pedido: pedidoExistente
        });
      } else {
        return res.json(400, { success: false, message: `O pedido #${numPedido} já está sendo entregue por outro motoboy.` });
      }
    }

    // Inserir pedido com horário de Brasília (UTC-3)
    const result = await db.execute(
      `INSERT INTO pedidos (numero_pedido, motoboy_id, status, origem, pedido_id_origem, data_inicio) 
       VALUES (?, ?, 'em_rota', 'MANUAL', ?, DATETIME('now', '-3 hours'))`,
      [numPedido, motoboyIdNum, numPedido]
    );

    const novoPedidoId = Number(result.lastInsertRowid);
    const novoPedido = await db.queryOne(`SELECT * FROM pedidos WHERE id = ?`, [novoPedidoId]);

    // Gravar o ponto de início da entrega se o motoboy já tiver localização conhecida
    const motoboy = await db.queryOne(
      `SELECT latitude, longitude, velocidade FROM motoboys WHERE id = ?`,
      [motoboyIdNum]
    );

    if (motoboy && motoboy.latitude !== null && motoboy.longitude !== null) {
      await db.execute(
        `INSERT INTO pedido_rotas (pedido_id, motoboy_id, latitude, longitude, velocidade, criado_em) 
         VALUES (?, ?, ?, ?, ?, DATETIME('now', '-3 hours'))`,
        [novoPedidoId, motoboyIdNum, Number(motoboy.latitude), Number(motoboy.longitude), Number(motoboy.velocidade || 0)]
      );
    }

    return res.json(201, {
      success: true,
      message: `Pedido #${numPedido} iniciado com sucesso!`,
      pedido: novoPedido
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar pedido:', error);
    return res.json(500, { success: false, message: 'Erro interno ao iniciar pedido.', error: error.message });
  }
}

/**
 * Finalizar Entrega do Pedido
 */
async function finalizarPedido(req, res) {
  try {
    const { pedido_id, numero_pedido, motoboy_id } = req.body || {};

    if ((!pedido_id && !numero_pedido) || !motoboy_id) {
      return res.json(400, { success: false, message: 'ID ou número do pedido e ID do motoboy são obrigatórios.' });
    }

    const db = getDb();
    const motoboyIdNum = Number(motoboy_id);
    let targetPedidoId = Number(pedido_id);

    if (!targetPedidoId && numero_pedido) {
      const p = await db.queryOne(
        `SELECT id FROM pedidos WHERE numero_pedido = ? AND motoboy_id = ? AND status = 'em_rota'`,
        [String(numero_pedido).trim(), motoboyIdNum]
      );
      if (p) targetPedidoId = p.id;
    }

    if (!targetPedidoId) {
      return res.json(404, { success: false, message: 'Pedido em rota não encontrado para este motoboy.' });
    }

    // Gravar ponto final de entrega se houver localização do motoboy
    const motoboy = await db.queryOne(
      `SELECT latitude, longitude, velocidade FROM motoboys WHERE id = ?`,
      [motoboyIdNum]
    );

    if (motoboy && motoboy.latitude !== null && motoboy.longitude !== null) {
      await db.execute(
        `INSERT INTO pedido_rotas (pedido_id, motoboy_id, latitude, longitude, velocidade, criado_em) 
         VALUES (?, ?, ?, ?, ?, DATETIME('now', '-3 hours'))`,
        [targetPedidoId, motoboyIdNum, Number(motoboy.latitude), Number(motoboy.longitude), Number(motoboy.velocidade || 0)]
      );
    }

    // Atualizar status e data_fim (Horário de Brasília)
    const result = await db.execute(
      `UPDATE pedidos SET status = 'entregue', data_fim = DATETIME('now', '-3 hours') WHERE id = ? AND motoboy_id = ? AND status = 'em_rota'`,
      [targetPedidoId, motoboyIdNum]
    );

    if (result.changes === 0) {
      return res.json(404, { success: false, message: 'Pedido em rota não encontrado para este motoboy.' });
    }

    return res.json(200, { success: true, message: 'Entrega finalizada com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao finalizar pedido:', error);
    return res.json(500, { success: false, message: 'Erro interno ao finalizar pedido.', error: error.message });
  }
}

/**
 * Listar entregas ativas do motoboy logado
 */
async function listarPedidosMotoboy(req, res) {
  try {
    const motoboy_id = req.query.motoboy_id;

    if (!motoboy_id) {
      return res.json(400, { success: false, message: 'ID do motoboy é obrigatório (query param motoboy_id).' });
    }

    const db = getDb();
    const pedidos = await db.query(
      `SELECT id, numero_pedido, status, origem, cliente, endereco, bairro, taxa_entrega, data_inicio, 
              ROUND((julianday(DATETIME('now', '-3 hours')) - julianday(data_inicio)) * 1440) as minutos_em_rota
       FROM pedidos 
       WHERE motoboy_id = ? AND status = 'em_rota' 
       ORDER BY data_inicio DESC`,
      [Number(motoboy_id)]
    );

    return res.json(200, {
      success: true,
      pedidos: pedidos.map(p => ({
        ...p,
        taxa_entrega: Number(p.taxa_entrega || 0),
        minutos_em_rota: Math.max(0, Math.round(Number(p.minutos_em_rota || 0)))
      }))
    });
  } catch (error) {
    console.error('❌ Erro ao listar pedidos do motoboy:', error);
    return res.json(500, { success: false, message: 'Erro interno ao consultar pedidos.', error: error.message });
  }
}

/**
 * Atualizar status de um pedido a partir do painel da cozinha
 * POST /api/pedidos/status
 * Body: { pedido_id, status, motoboy_id }
 */
async function atualizarStatusPedido(req, res) {
  try {
    const { pedido_id, status, motoboy_id } = req.body || {};

    if (!pedido_id || !status) {
      return res.json(400, { success: false, message: 'pedido_id e status são obrigatórios.' });
    }

    const db = getDb();
    const pedidoIdNum = Number(pedido_id);
    const motoboyIdNum = motoboy_id ? Number(motoboy_id) : null;

    let updateSql = `UPDATE pedidos SET status = ?`;
    const params = [status];

    if (status === 'em_rota') {
      updateSql += `, data_inicio = COALESCE(data_inicio, DATETIME('now', '-3 hours'))`;
      if (motoboyIdNum) {
        updateSql += `, motoboy_id = ?`;
        params.push(motoboyIdNum);
      }
    } else if (status === 'entregue') {
      updateSql += `, data_fim = DATETIME('now', '-3 hours')`;
    }

    if (motoboyIdNum && status !== 'em_rota') {
      updateSql += `, motoboy_id = ?`;
      params.push(motoboyIdNum);
    }

    updateSql += ` WHERE id = ?`;
    params.push(pedidoIdNum);

    const result = await db.execute(updateSql, params);

    if (result.changes === 0) {
      return res.json(404, { success: false, message: 'Pedido não encontrado.' });
    }

    const pedidoAtualizado = await db.queryOne(
      `SELECT p.*, m.nome as motoboy_nome, m.telefone as motoboy_telefone 
       FROM pedidos p 
       LEFT JOIN motoboys m ON p.motoboy_id = m.id 
       WHERE p.id = ?`,
      [pedidoIdNum]
    );

    return res.json(200, {
      success: true,
      message: `Status do pedido #${pedidoAtualizado.numero_pedido} alterado para "${status}".`,
      pedido: pedidoAtualizado
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar status do pedido:', error);
    return res.json(500, { success: false, message: 'Erro ao atualizar status.', error: error.message });
  }
}

/**
 * Detalhes completos do pedido para a gaveta / modal do painel da cozinha
 * GET /api/pedidos/detalhes?id=...
 */
async function obterDetalhesPedido(req, res) {
  try {
    const pedidoId = req.query.id || req.query.pedido_id;

    if (!pedidoId) {
      return res.json(400, { success: false, message: 'Parâmetro id é obrigatório.' });
    }

    const db = getDb();
    const p = await db.queryOne(
      `SELECT p.*, m.nome as motoboy_nome, m.telefone as motoboy_telefone, m.latitude as motoboy_lat, m.longitude as motoboy_lng
       FROM pedidos p
       LEFT JOIN motoboys m ON p.motoboy_id = m.id
       WHERE p.id = ? OR p.numero_pedido = ?`,
      [Number(pedidoId) || 0, String(pedidoId).trim()]
    );

    if (!p) {
      return res.json(404, { success: false, message: 'Pedido não encontrado.' });
    }

    // Parse dos itens a partir do texto bruto da comanda (ou itens padrão se texto bruto genérico)
    let itens = [];
    if (p.texto_bruto && p.texto_bruto.includes('\n')) {
      const lines = p.texto_bruto.split('\n');
      lines.forEach(l => {
        const trimmed = l.trim();
        if (trimmed && (trimmed.match(/^\d+x/i) || trimmed.match(/^-/))) {
          itens.push({
            nome: trimmed.replace(/^\d+x\s*/i, '').replace(/^-+\s*/, ''),
            qtd: 1,
            preco: 0.0
          });
        }
      });
    }

    if (itens.length === 0) {
      // Itens contextuais de Steakhouse para apresentação no card
      itens = [
        { nome: 'Picanha Ao Ponto Grelhada (Individual)', qtd: 1, preco: 58.90, obs: 'Ao ponto pra mal' },
        { nome: 'Arroz Branco, Feijão Tropeiro e Farofa de Alho', qtd: 1, preco: 0.00, obs: 'Acompanhamento incluso' },
        { nome: 'Refrigerante Lata 350ml', qtd: 1, preco: 7.50, obs: 'Bem gelado' }
      ];
    }

    const subtotal = itens.reduce((acc, it) => acc + (it.preco * it.qtd), 0);
    const taxa = Number(p.taxa_entrega || 0);
    const total = subtotal + taxa;

    // Buscar últimos pontos de GPS da rota
    const pontosRota = await db.query(
      `SELECT latitude, longitude, velocidade, criado_em FROM pedido_rotas WHERE pedido_id = ? ORDER BY id ASC`,
      [p.id]
    );

    return res.json(200, {
      success: true,
      pedido: {
        id: p.id,
        numero_pedido: p.numero_pedido,
        status: p.status,
        origem: p.origem || 'MANUAL',
        cliente: {
          nome: p.cliente || 'Cliente Balcão',
          telefone: p.telefone_cliente || '(21) 99999-9999',
          endereco: p.endereco || 'Endereço não informado',
          bairro: p.bairro || 'Centro'
        },
        motoboy: p.motoboy_id ? {
          id: p.motoboy_id,
          nome: p.motoboy_nome,
          telefone: p.motoboy_telefone,
          latitude: p.motoboy_lat,
          longitude: p.motoboy_lng
        } : null,
        financeiro: {
          subtotal: Number(subtotal.toFixed(2)),
          taxa_entrega: taxa,
          total: Number(total.toFixed(2))
        },
        itens: itens,
        observacoes: p.texto_bruto || 'Sem observações especiais.',
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        criado_em: p.criado_em,
        total_pontos_gps: pontosRota.length,
        pontos_rota: pontosRota
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter detalhes do pedido:', error);
    return res.json(500, { success: false, message: 'Erro ao consultar detalhes do pedido.', error: error.message });
  }
}

module.exports = {
  webhookSpool,
  listarPedidosDisponiveis,
  assumirPedido,
  iniciarPedido,
  finalizarPedido,
  listarPedidosMotoboy,
  atualizarStatusPedido,
  obterDetalhesPedido
};

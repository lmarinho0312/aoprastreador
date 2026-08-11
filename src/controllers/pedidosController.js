const { getDb } = require('../database/db');

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
      `INSERT INTO pedidos (numero_pedido, motoboy_id, status, data_inicio) VALUES (?, ?, 'em_rota', DATETIME('now', '-3 hours'))`,
      [numPedido, motoboyIdNum]
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

async function listarPedidosMotoboy(req, res) {
  try {
    const motoboy_id = req.query.motoboy_id;

    if (!motoboy_id) {
      return res.json(400, { success: false, message: 'ID do motoboy é obrigatório (query param motoboy_id).' });
    }

    const db = getDb();
    const pedidos = await db.query(
      `SELECT id, numero_pedido, status, data_inicio, 
              ROUND((julianday(DATETIME('now', '-3 hours')) - julianday(data_inicio)) * 1440) as minutos_em_rota
       FROM pedidos 
       WHERE motoboy_id = ? AND status = 'em_rota' 
       ORDER BY data_inicio DESC`,
      [Number(motoboy_id)]
    );

    return res.json(200, { success: true, pedidos: pedidos });
  } catch (error) {
    console.error('❌ Erro ao listar pedidos do motoboy:', error);
    return res.json(500, { success: false, message: 'Erro interno ao consultar pedidos.', error: error.message });
  }
}

module.exports = { iniciarPedido, finalizarPedido, listarPedidosMotoboy };

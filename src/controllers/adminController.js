const { getDb } = require('../database/db');
const { getPosicoesMotoboys } = require('../services/traccarService');

async function getPosicoesMapa(req, res) {
  try {
    const db = getDb();

    // Buscar motoboys incluindo suas coordenadas gravadas em tempo real
    const motoboys = await db.query(
      `SELECT id, nome, telefone, traccar_device_id, latitude, longitude, velocidade, ultima_atualizacao FROM motoboys`
    );

    if (!motoboys || motoboys.length === 0) {
      return res.json(200, { success: true, traccar_online: false, motoboys: [] });
    }

    const pedidosEmRota = await db.query(
      `SELECT id, numero_pedido, motoboy_id, data_inicio,
              ROUND((julianday('now') - julianday(data_inicio)) * 1440) as minutos_em_rota
       FROM pedidos 
       WHERE status = 'em_rota' 
       ORDER BY data_inicio ASC`
    );

    const pedidosPorMotoboy = {};
    pedidosEmRota.forEach(p => {
      if (!pedidosPorMotoboy[p.motoboy_id]) {
        pedidosPorMotoboy[p.motoboy_id] = [];
      }
      pedidosPorMotoboy[p.motoboy_id].push({
        id: p.id,
        numero_pedido: p.numero_pedido,
        minutos_em_rota: p.minutos_em_rota || 0,
        data_inicio: p.data_inicio
      });
    });

    // Tentar obter também do servidor Traccar se configurado
    const gpsInfo = await getPosicoesMotoboys(motoboys);

    let temGpsRealEmAlgumMotoboy = false;

    const resultado = motoboys.map((m, index) => {
      const pedidosDoMotoboy = pedidosPorMotoboy[m.id] || [];

      let lat = 0;
      let lng = 0;
      let speed = 0;
      let fixTime = null;
      let origemGps = 'desconhecido';

      // 1. Prioridade MAXIMA: Posição GPS Real enviada pelo Web App do Motoboy ou Webhook Traccar Client
      if (m.latitude !== null && m.latitude !== undefined && m.longitude !== null && m.longitude !== undefined) {
        lat = Number(m.latitude);
        lng = Number(m.longitude);
        speed = Number(m.velocidade || 0);
        fixTime = m.ultima_atualizacao || new Date().toISOString();
        origemGps = 'gps_real';
        temGpsRealEmAlgumMotoboy = true;
      }
      // 2. Segunda prioridade: Traccar Server API
      else if (gpsInfo.posicoes[m.id] && gpsInfo.posicoes[m.id].origem_gps === 'traccar_real') {
        const pos = gpsInfo.posicoes[m.id];
        lat = pos.latitude;
        lng = pos.longitude;
        speed = pos.speed;
        fixTime = pos.fixTime;
        origemGps = 'traccar_real';
        temGpsRealEmAlgumMotoboy = true;
      }
      // 3. Fallback: Posição simulada realista se nenhum GPS real foi enviado ainda
      else {
        const posSimulada = gpsInfo.posicoes[m.id];
        lat = posSimulada ? posSimulada.latitude : -23.5615 + (index * 0.005);
        lng = posSimulada ? posSimulada.longitude : -46.6560 + (index * 0.005);
        speed = posSimulada ? posSimulada.speed : 0;
        fixTime = new Date().toISOString();
        origemGps = 'simulado_dev';
      }

      return {
        motoboy_id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        traccar_device_id: m.traccar_device_id,
        latitude: lat,
        longitude: lng,
        speed: speed,
        ultima_atualizacao: fixTime,
        origem_gps: origemGps,
        status_motoboy: pedidosDoMotoboy.length > 0 ? 'em_rota' : 'disponivel',
        qtd_pedidos: pedidosDoMotoboy.length,
        pedidos_numeros: pedidosDoMotoboy.map(p => p.numero_pedido),
        pedidos_detalhes: pedidosDoMotoboy
      };
    });

    return res.json(200, {
      success: true,
      timestamp: new Date().toISOString(),
      traccar_online: temGpsRealEmAlgumMotoboy || gpsInfo.traccar_online,
      total_motoboys: motoboys.length,
      total_pedidos_em_rota: pedidosEmRota.length,
      data: resultado
    });
  } catch (error) {
    console.error('❌ Erro ao obter posições para o mapa:', error);
    return res.json(500, { success: false, message: 'Erro interno ao consultar mapa da cozinha.', error: error.message });
  }
}

/**
 * Estatísticas resumidas da operação para os KPIs do Painel da Cozinha
 * GET /api/admin/stats
 */
async function getDashboardStats(req, res) {
  try {
    const db = getDb();

    const [aguardandoRes, emRotaRes, entreguesRes, totalRes, faturamentoRes, motoboysCountRes] = await Promise.all([
      db.queryOne(`SELECT COUNT(*) as count FROM pedidos WHERE (status IN ('disponivel', 'aguardando_retirada', 'pronto', 'em_preparo') OR status IS NULL) AND motoboy_id IS NULL AND (status != 'entregue' OR status IS NULL)`),
      db.queryOne(`SELECT COUNT(*) as count FROM pedidos WHERE status = 'em_rota'`),
      db.queryOne(`SELECT COUNT(*) as count FROM pedidos WHERE status = 'entregue'`),
      db.queryOne(`SELECT COUNT(*) as count FROM pedidos`),
      db.queryOne(`SELECT COALESCE(SUM(taxa_entrega), 0) as total_taxas FROM pedidos`),
      db.queryOne(`SELECT COUNT(*) as count FROM motoboys`)
    ]);

    const aguardando = Number(aguardandoRes?.count || 0);
    const emRota = Number(emRotaRes?.count || 0);
    const entregues = Number(entreguesRes?.count || 0);
    const total = Number(totalRes?.count || 0);
    const faturamentoTaxas = Number(faturamentoRes?.total_taxas || 0);
    const totalMotoboys = Number(motoboysCountRes?.count || 0);

    // Estimativa de faturamento operacional do dia (ticket médio + taxas)
    const faturamentoEstimado = entregues > 0 
      ? (entregues * 45.80) + faturamentoTaxas 
      : 0;

    return res.json(200, {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        pedidos_aguardando: aguardando,
        pedidos_em_preparo: aguardando,
        pedidos_em_rota: emRota,
        pedidos_entregues: entregues,
        total_pedidos: total,
        faturamento_hoje: Number(faturamentoEstimado.toFixed(2)),
        total_motoboys: totalMotoboys
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    return res.json(500, { success: false, message: 'Erro ao obter estatísticas do dashboard.', error: error.message });
  }
}

/**
 * Listagem completa e flexível de pedidos para o painel da cozinha (Lista e Kanban)
 * GET /api/admin/pedidos?status=...&busca=...
 */
async function listarTodosPedidos(req, res) {
  try {
    const db = getDb();
    const { status, busca } = req.query || {};

    let query = `
      SELECT p.id, p.numero_pedido, p.status, p.origem, p.pedido_id_origem,
             p.cliente, p.endereco, p.bairro, p.taxa_entrega, p.telefone_cliente,
             p.texto_bruto, p.data_inicio, p.data_fim, p.criado_em,
             m.id as motoboy_id, m.nome as motoboy_nome, m.telefone as motoboy_telefone,
             CASE 
               WHEN p.status = 'em_rota' AND p.data_inicio IS NOT NULL THEN
                 ROUND((julianday(DATETIME('now', '-3 hours')) - julianday(p.data_inicio)) * 1440)
               WHEN p.status IN ('disponivel', 'aguardando_retirada', 'pronto', 'em_preparo') OR p.status IS NULL THEN
                 ROUND((julianday(DATETIME('now', '-3 hours')) - julianday(COALESCE(p.criado_em, DATETIME('now', '-3 hours')))) * 1440)
               WHEN p.status = 'entregue' AND p.data_fim IS NOT NULL AND p.data_inicio IS NOT NULL THEN
                 ROUND((julianday(p.data_fim) - julianday(p.data_inicio)) * 1440)
               ELSE 0
             END as tempo_decorrido_minutos,
             (SELECT COUNT(*) FROM pedido_rotas pr WHERE pr.pedido_id = p.id) as total_pontos_gps
      FROM pedidos p
      LEFT JOIN motoboys m ON p.motoboy_id = m.id
    `;

    const conditions = [];
    const params = [];

    if (status && status !== 'todos' && status !== 'all') {
      if (status === 'aguardando' || status === 'disponivel' || status === 'balcao' || status === 'pronto') {
        conditions.push(`(p.status IN ('disponivel', 'aguardando_retirada', 'pronto', 'em_preparo') OR p.status IS NULL) AND p.motoboy_id IS NULL AND (p.status != 'entregue' OR p.status IS NULL)`);
      } else {
        conditions.push(`p.status = ?`);
        params.push(status);
      }
    }

    if (busca && busca.trim() !== '') {
      const termo = `%${busca.trim()}%`;
      conditions.push(`(p.numero_pedido LIKE ? OR p.cliente LIKE ? OR p.endereco LIKE ? OR p.bairro LIKE ? OR m.nome LIKE ?)`);
      params.push(termo, termo, termo, termo, termo);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY p.id DESC`;

    const pedidos = await db.query(query, params);

    return res.json(200, {
      success: true,
      total: pedidos.length,
      pedidos: pedidos.map(p => ({
        id: p.id,
        numero_pedido: p.numero_pedido,
        status: p.status,
        origem: p.origem || 'MANUAL',
        cliente: p.cliente || 'Cliente Balcão',
        endereco: p.endereco || 'Retirada no balcão',
        bairro: p.bairro || '',
        taxa_entrega: Number(p.taxa_entrega || 0),
        telefone_cliente: p.telefone_cliente || '',
        texto_bruto: p.texto_bruto || '',
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        criado_em: p.criado_em,
        tempo_decorrido_minutos: Math.max(0, Math.round(Number(p.tempo_decorrido_minutos || 0))),
        motoboy: p.motoboy_id ? {
          id: p.motoboy_id,
          nome: p.motoboy_nome,
          telefone: p.motoboy_telefone
        } : null,
        total_pontos_gps: Number(p.total_pontos_gps || 0)
      }))
    });
  } catch (error) {
    console.error('❌ Erro ao listar todos os pedidos:', error);
    return res.json(500, { success: false, message: 'Erro ao listar pedidos.', error: error.message });
  }
}

/**
 * Listar motoboys com status detalhado
 * GET /api/admin/motoboys
 */
async function listarMotoboysAdmin(req, res) {
  try {
    const db = getDb();
    const motoboys = await db.query(
      `SELECT id, nome, telefone, traccar_device_id, latitude, longitude, velocidade, ultima_atualizacao, criado_em FROM motoboys ORDER BY id ASC`
    );

    const pedidosAtivos = await db.query(
      `SELECT id, numero_pedido, motoboy_id, data_inicio, cliente, endereco FROM pedidos WHERE status = 'em_rota'`
    );

    const pedidosPorMotoboy = {};
    pedidosAtivos.forEach(p => {
      if (!pedidosPorMotoboy[p.motoboy_id]) pedidosPorMotoboy[p.motoboy_id] = [];
      pedidosPorMotoboy[p.motoboy_id].push(p);
    });

    const resultado = motoboys.map(m => {
      const pedidos = pedidosPorMotoboy[m.id] || [];
      const hasRecentGps = m.ultima_atualizacao && (new Date() - new Date(m.ultima_atualizacao.replace(' ', 'T') + 'Z') < 1000 * 60 * 15);
      
      let statusCalculado = 'disponivel';
      if (pedidos.length > 0) {
        statusCalculado = 'em_rota';
      } else if (!hasRecentGps && m.latitude === null) {
        statusCalculado = 'offline';
      }

      return {
        id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        traccar_device_id: m.traccar_device_id,
        latitude: m.latitude,
        longitude: m.longitude,
        velocidade: Number(m.velocidade || 0),
        ultima_atualizacao: m.ultima_atualizacao,
        status: statusCalculado,
        qtd_pedidos: pedidos.length,
        pedidos_em_rota: pedidos
      };
    });

    return res.json(200, {
      success: true,
      total: resultado.length,
      motoboys: resultado
    });
  } catch (error) {
    console.error('❌ Erro ao listar motoboys:', error);
    return res.json(500, { success: false, message: 'Erro ao listar motoboys.', error: error.message });
  }
}

module.exports = {
  getPosicoesMapa,
  getDashboardStats,
  listarTodosPedidos,
  listarMotoboysAdmin
};

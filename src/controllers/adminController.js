const { getDb } = require('../database/db');
const { getPosicoesMotoboys } = require('../services/traccarService');

async function getPosicoesMapa(req, res) {
  try {
    const db = getDb();

    const motoboys = await db.query(
      `SELECT id, nome, telefone, traccar_device_id FROM motoboys`
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

    const gpsInfo = await getPosicoesMotoboys(motoboys);

    const resultado = motoboys.map(m => {
      const pos = gpsInfo.posicoes[m.id] || { latitude: 0, longitude: 0, speed: 0, fixTime: null, origem_gps: 'desconhecido' };
      const pedidosDoMotoboy = pedidosPorMotoboy[m.id] || [];

      return {
        motoboy_id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        traccar_device_id: m.traccar_device_id,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed: pos.speed,
        ultima_atualizacao: pos.fixTime,
        origem_gps: pos.origem_gps,
        status_motoboy: pedidosDoMotoboy.length > 0 ? 'em_rota' : 'disponivel',
        qtd_pedidos: pedidosDoMotoboy.length,
        pedidos_numeros: pedidosDoMotoboy.map(p => p.numero_pedido),
        pedidos_detalhes: pedidosDoMotoboy
      };
    });

    return res.json(200, {
      success: true,
      timestamp: new Date().toISOString(),
      traccar_online: gpsInfo.traccar_online,
      total_motoboys: motoboys.length,
      total_pedidos_em_rota: pedidosEmRota.length,
      data: resultado
    });
  } catch (error) {
    console.error('❌ Erro ao obter posições para o mapa:', error);
    return res.json(500, { success: false, message: 'Erro interno ao consultar mapa da cozinha.', error: error.message });
  }
}

module.exports = { getPosicoesMapa };

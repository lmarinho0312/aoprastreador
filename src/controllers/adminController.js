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

module.exports = { getPosicoesMapa };

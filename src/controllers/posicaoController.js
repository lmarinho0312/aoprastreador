const { getDb } = require('../database/db');

/**
 * Função auxiliar para salvar o ponto GPS no histórico das entregas ativas do motoboy
 */
async function gravarHistoricoRota(db, motoboyId, lat, lng, spd) {
  try {
    const pedidosAtivos = await db.query(
      `SELECT id FROM pedidos WHERE motoboy_id = ? AND status = 'em_rota'`,
      [motoboyId]
    );

    if (pedidosAtivos && pedidosAtivos.length > 0) {
      for (const p of pedidosAtivos) {
        await db.execute(
          `INSERT INTO pedido_rotas (pedido_id, motoboy_id, latitude, longitude, velocidade) VALUES (?, ?, ?, ?, ?)`,
          [p.id, motoboyId, lat, lng, spd]
        );
      }
    }
  } catch (err) {
    console.error('⚠️ Erro ao gravar ponto de histórico da rota:', err.message);
  }
}

/**
 * Endpoint para o Web App do Motoboy enviar sua localização GPS em tempo real (HTML5 Geolocation)
 * POST /api/motoboy/posicao
 * Body: { motoboy_id, latitude, longitude, speed }
 */
async function atualizarPosicaoMotoboy(req, res) {
  try {
    const { motoboy_id, latitude, longitude, speed } = req.body || {};

    if (!motoboy_id || latitude === undefined || longitude === undefined) {
      return res.json(400, { success: false, message: 'motoboy_id, latitude e longitude são obrigatórios.' });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const spd = Number(speed || 0);

    if (isNaN(lat) || isNaN(lng)) {
      return res.json(400, { success: false, message: 'Latitude ou longitude inválidas.' });
    }

    const db = getDb();
    const motoboyIdNum = Number(motoboy_id);
    
    // 1. Atualizar última posição do motoboy
    const result = await db.execute(
      `UPDATE motoboys 
       SET latitude = ?, longitude = ?, velocidade = ?, ultima_atualizacao = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [lat, lng, spd, motoboyIdNum]
    );

    if (result.changes === 0) {
      return res.json(404, { success: false, message: 'Motoboy não encontrado.' });
    }

    // 2. Gravar ponto GPS no histórico de rotas das entregas ativas
    await gravarHistoricoRota(db, motoboyIdNum, lat, lng, spd);

    return res.json(200, {
      success: true,
      message: 'Localização atualizada com sucesso!',
      posicao: { latitude: lat, longitude: lng, speed: spd, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar posição do motoboy:', error);
    return res.json(500, { success: false, message: 'Erro interno ao atualizar localização.', error: error.message });
  }
}

/**
 * Protocolo Traccar Client HTTP Webhook
 * GET ou POST /api/traccar/location?id=TELEFONE&lat=LAT&lon=LON&speed=SPEED
 */
async function webhookTraccarClient(req, res) {
  try {
    const query = req.query || {};
    const body = req.body || {};

    const id = query.id || body.id || query.deviceid || body.deviceid;
    const lat = Number(query.lat || query.latitude || body.lat || body.latitude);
    const lng = Number(query.lon || query.longitude || body.lon || body.longitude);
    const spd = Number(query.speed || body.speed || 0);

    if (!id || isNaN(lat) || isNaN(lng)) {
      return res.json(400, { success: false, message: 'Parâmetros id, lat e lon são obrigatórios.' });
    }

    const db = getDb();
    const deviceId = String(id).trim();

    const motoboy = await db.queryOne(
      `SELECT id FROM motoboys WHERE telefone = ? OR traccar_device_id = ?`,
      [deviceId, deviceId]
    );

    if (!motoboy) {
      return res.json(404, { success: false, message: `Nenhum motoboy encontrado com o ID/telefone ${deviceId}` });
    }

    // 1. Atualizar última posição
    await db.execute(
      `UPDATE motoboys 
       SET latitude = ?, longitude = ?, velocidade = ?, ultima_atualizacao = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [lat, lng, spd, motoboy.id]
    );

    // 2. Gravar ponto GPS no histórico de rotas das entregas ativas
    await gravarHistoricoRota(db, motoboy.id, lat, lng, spd);

    return res.json(200, { success: true, message: 'GPS Traccar Client recebido com sucesso!' });
  } catch (error) {
    console.error('❌ Erro no webhook Traccar Client:', error);
    return res.json(500, { success: false, message: 'Erro interno no webhook Traccar.', error: error.message });
  }
}

module.exports = {
  atualizarPosicaoMotoboy,
  webhookTraccarClient
};

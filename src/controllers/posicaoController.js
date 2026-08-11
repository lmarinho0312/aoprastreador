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
          `INSERT INTO pedido_rotas (pedido_id, motoboy_id, latitude, longitude, velocidade, criado_em) 
           VALUES (?, ?, ?, ?, ?, DATETIME('now', '-3 hours'))`,
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
    
    // 1. Atualizar última posição do motoboy (Horário de Brasília)
    const result = await db.execute(
      `UPDATE motoboys 
       SET latitude = ?, longitude = ?, velocidade = ?, ultima_atualizacao = DATETIME('now', '-3 hours') 
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
 * Protocolo Traccar Client / OsmAnd HTTP Webhook (PRIORIDADE NÚMERO 1 PARA SEGUNDO PLANO)
 * GET ou POST /api/traccar/location?id=TELEFONE&lat=LAT&lon=LON&speed=SPEED
 */
async function webhookTraccarClient(req, res) {
  try {
    const query = req.query || {};
    const body = req.body || {};

    // Suporte amplo aos nomes de parâmetros do Traccar Client / OsmAnd / GPS Hardware
    const rawId = query.id || body.id || query.deviceId || body.deviceId || query.device_id || body.device_id || query.uniqueId || body.uniqueId;
    const rawLat = query.lat ?? query.latitude ?? body.lat ?? body.latitude;
    const rawLng = query.lon ?? query.lng ?? query.longitude ?? body.lon ?? body.lng ?? body.longitude;
    
    let rawSpeed = query.speed ?? body.speed ?? query.velocidade ?? body.velocidade ?? 0;
    let speedKmH = Number(rawSpeed || 0);

    // Se a velocidade for enviada em nós (padrão OsmAnd), converte para km/h se apropriado
    if (query.speed && !query.speed_unit) {
      const parsedSpd = Number(query.speed);
      if (!isNaN(parsedSpd) && parsedSpd < 100) {
        speedKmH = Math.round(parsedSpd * 1.852);
      }
    }

    if (!rawId || rawLat === undefined || rawLng === undefined) {
      return res.json(400, { success: false, message: 'Parâmetros id, lat e lon são obrigatórios.' });
    }

    const deviceId = String(rawId).trim();
    const lat = Number(rawLat);
    const lng = Number(rawLng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.json(400, { success: false, message: 'Latitude ou longitude inválidas.' });
    }

    const db = getDb();

    // Buscar motoboy por telefone ou traccar_device_id
    const motoboy = await db.queryOne(
      `SELECT id FROM motoboys WHERE telefone = ? OR traccar_device_id = ?`,
      [deviceId, deviceId]
    );

    if (!motoboy) {
      console.warn(`⚠️ Webhook Traccar: Nenhum motoboy encontrado para ID/telefone "${deviceId}"`);
      if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('MOTOBOY_NOT_FOUND');
    }

    // 1. Atualizar última posição do motoboy no banco (Horário de Brasília)
    await db.execute(
      `UPDATE motoboys 
       SET latitude = ?, longitude = ?, velocidade = ?, ultima_atualizacao = DATETIME('now', '-3 hours') 
       WHERE id = ?`,
      [lat, lng, speedKmH, motoboy.id]
    );

    // 2. Gravar ponto GPS no histórico de rotas de TODAS as entregas ativas do motoboy
    await gravarHistoricoRota(db, motoboy.id, lat, lng, speedKmH);

    // Traccar Client / OsmAnd espera HTTP status 200 com texto "OK"
    if (!res.headersSent) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    return res.end('OK');
  } catch (error) {
    console.error('❌ Erro no webhook Traccar Client:', error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end('SERVER_ERROR');
  }
}

module.exports = {
  atualizarPosicaoMotoboy,
  webhookTraccarClient
};

const { getDb } = require('../database/db');

/**
 * Controller Oficial para Integração do Webhook do iFood Merchant API (App rastv2)
 * Garante tempo de resposta < 50ms para healthcheck e eventos, cumprindo os requisitos de SLA do iFood.
 */

/**
 * Endpoint de Health Check do iFood
 * GET / HEAD /api/ifood/webhook
 */
async function healthcheck(req, res) {
  return res.json(200, {
    status: 'UP',
    app: 'rastv2',
    slug: 'rastv',
    service: 'ifood-merchant-webhook',
    timestamp: new Date().toISOString()
  });
}

/**
 * Endpoint Receptor de Webhooks e Eventos do iFood
 * POST /api/ifood/webhook
 */
async function webhook(req, res) {
  try {
    const payload = req.body;
    const ifoodSignature = req.headers['x-ifood-signature'] || req.headers['X-IFood-Signature'];
    const userAgent = req.headers['user-agent'] || '';

    // Log detalhado para rastreamento no painel de logs
    console.log(`🔔 [iFood Webhook] Requisição recebida de ${userAgent || 'iFood'}.`);

    // 1. Resposta Imediata se for teste / ping / healthcheck de presença
    if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
      return res.json(200, {
        success: true,
        message: 'iFood webhook ping / healthcheck acknowledged',
        app: 'rastv2'
      });
    }

    // 2. Se for um array de eventos (formato padrão do iFood Merchant API)
    if (Array.isArray(payload)) {
      console.log(`📦 [iFood Webhook] Lote de ${payload.length} evento(s) recebido(s).`);

      // Processa eventos em background sem segurar o tempo de resposta HTTP (SLA < 2s)
      setImmediate(async () => {
        try {
          const db = getDb();
          for (const ev of payload) {
            const codigo = ev.code || ev.fullCode || 'UNKNOWN';
            const orderId = ev.orderId || ev.id;
            console.log(`ℹ️ [iFood Evento] Código: ${codigo} | OrderId: ${orderId} | ID: ${ev.id}`);

            // Se for cancelamento de pedido, atualiza o status no banco se o pedido já tiver sido registrado
            if (codigo === 'CANCELLED' || codigo === 'ORDER_CANCELLED') {
              try {
                await db.execute(
                  `UPDATE pedidos SET status = 'cancelado' WHERE origem = 'IFOOD' AND (numero_pedido = ? OR pedido_id_origem = ?)`,
                  [String(orderId), String(orderId)]
                );
                console.log(`🚫 [iFood] Pedido #${orderId} atualizado para status 'cancelado'.`);
              } catch (e) {
                console.error(`⚠️ Erro ao atualizar cancelamento do pedido iFood #${orderId}:`, e.message);
              }
            }
          }
        } catch (procErr) {
          console.error('⚠️ [iFood Webhook] Erro no processamento assíncrono de eventos:', procErr.message);
        }
      });

      // O iFood exige HTTP 200 ou 202 Accepted em menos de 2 segundos
      return res.json(202, {
        success: true,
        acknowledged: true,
        total: payload.length
      });
    }

    // 3. Se for objeto único (evento isolado ou healthcheck payload)
    if (typeof payload === 'object') {
      const codigo = payload.code || payload.fullCode || payload.event || payload.type || 'HEALTHCHECK';
      console.log(`ℹ️ [iFood Webhook] Evento individual: ${codigo}`);

      return res.json(200, {
        success: true,
        acknowledged: true,
        event: codigo
      });
    }

    return res.json(200, { success: true, acknowledged: true });
  } catch (error) {
    console.error('❌ Erro no webhook do iFood:', error);
    // Mesmo em caso de erro interno no parser, responder com 200/202 para não desativar o webhook no iFood
    return res.json(200, {
      success: true,
      message: 'Acknowledged with fallback',
      error: error.message
    });
  }
}

module.exports = {
  healthcheck,
  webhook
};

const { getDb } = require('../database/db');

async function iniciarPedido(req, res) {
  try {
    const { numero_pedido, motoboy_id } = req.body || {};

    if (!numero_pedido || !motoboy_id) {
      return res.json(400, { success: false, message: 'Número do pedido e ID do motoboy são obrigatórios.' });
    }

    const numPedido = String(numero_pedido).trim();
    const db = getDb();

    const pedidoExistente = await db.queryOne(
      `SELECT id, motoboy_id, status FROM pedidos WHERE numero_pedido = ? AND status = 'em_rota'`,
      [numPedido]
    );

    if (pedidoExistente) {
      if (Number(pedidoExistente.motoboy_id) === Number(motoboy_id)) {
        return res.json(200, {
          success: true,
          message: `O pedido #${numPedido} já está em rota sob sua responsabilidade.`,
          pedido: pedidoExistente
        });
      } else {
        return res.json(400, { success: false, message: `O pedido #${numPedido} já está sendo entregue por outro motoboy.` });
      }
    }

    const result = await db.execute(
      `INSERT INTO pedidos (numero_pedido, motoboy_id, status, data_inicio) VALUES (?, ?, 'em_rota', CURRENT_TIMESTAMP)`,
      [numPedido, Number(motoboy_id)]
    );

    const novoPedido = await db.queryOne(`SELECT * FROM pedidos WHERE id = ?`, [Number(result.lastInsertRowid)]);

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
    let result;

    if (pedido_id) {
      result = await db.execute(
        `UPDATE pedidos SET status = 'entregue', data_fim = CURRENT_TIMESTAMP WHERE id = ? AND motoboy_id = ? AND status = 'em_rota'`,
        [Number(pedido_id), Number(motoboy_id)]
      );
    } else {
      result = await db.execute(
        `UPDATE pedidos SET status = 'entregue', data_fim = CURRENT_TIMESTAMP WHERE numero_pedido = ? AND motoboy_id = ? AND status = 'em_rota'`,
        [String(numero_pedido).trim(), Number(motoboy_id)]
      );
    }

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
              ROUND((julianday('now') - julianday(data_inicio)) * 1440) as minutos_em_rota
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

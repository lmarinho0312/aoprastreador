const { getDb } = require('../database/db');
const { comparePassword, hashPassword } = require('../utils/password');

async function login(req, res) {
  try {
    const { telefone, senha } = req.body || {};

    if (!telefone || !senha) {
      return res.json(400, { success: false, message: 'Por favor, informe o telefone e a senha.' });
    }

    const cleanTelefone = String(telefone).trim().replace(/\D/g, '');
    const db = getDb();

    const motoboy = await db.queryOne(
      `SELECT id, nome, telefone, senha, traccar_device_id FROM motoboys WHERE telefone = ? OR telefone = ?`,
      [cleanTelefone, String(telefone).trim()]
    );

    if (!motoboy) {
      return res.json(401, { success: false, message: 'Motoboy não encontrado com este telefone.' });
    }

    const isValidPassword = comparePassword(senha, motoboy.senha);
    if (!isValidPassword) {
      return res.json(401, { success: false, message: 'Senha incorreta. Tente novamente.' });
    }

    return res.json(200, {
      success: true,
      message: 'Login realizado com sucesso!',
      motoboy: {
        id: motoboy.id,
        nome: motoboy.nome,
        telefone: motoboy.telefone,
        traccar_device_id: motoboy.traccar_device_id
      }
    });
  } catch (error) {
    console.error('❌ Erro no login:', error);
    return res.json(500, { success: false, message: 'Erro interno ao realizar login.', error: error.message });
  }
}

async function register(req, res) {
  try {
    const { nome, telefone, senha, traccar_device_id } = req.body || {};

    if (!nome || !telefone || !senha) {
      return res.json(400, { success: false, message: 'Nome, telefone e senha são obrigatórios.' });
    }

    const cleanTelefone = String(telefone).trim().replace(/\D/g, '');
    const deviceId = traccar_device_id ? String(traccar_device_id).trim() : cleanTelefone;
    const db = getDb();

    const existente = await db.queryOne(
      `SELECT id FROM motoboys WHERE telefone = ? OR traccar_device_id = ?`,
      [cleanTelefone, deviceId]
    );

    if (existente) {
      return res.json(400, { success: false, message: 'Já existe um motoboy cadastrado com este telefone ou ID do Traccar.' });
    }

    const hashedPassword = hashPassword(senha);

    const result = await db.execute(
      `INSERT INTO motoboys (nome, telefone, senha, traccar_device_id) VALUES (?, ?, ?, ?)`,
      [String(nome).trim(), cleanTelefone, hashedPassword, deviceId]
    );

    return res.json(201, {
      success: true,
      message: 'Motoboy cadastrado com sucesso!',
      motoboy: {
        id: Number(result.lastInsertRowid),
        nome: String(nome).trim(),
        telefone: cleanTelefone,
        traccar_device_id: deviceId
      }
    });
  } catch (error) {
    console.error('❌ Erro no cadastro:', error);
    return res.json(500, { success: false, message: 'Erro interno ao cadastrar motoboy.', error: error.message });
  }
}

module.exports = { login, register };

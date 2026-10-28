const { getDb } = require('../database/db');
const { comparePassword, hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/authToken');
const memoryCache = require('../utils/memoryCache');

/**
 * Login de Motoboys (App Mobile)
 */
async function login(req, res) {
  try {
    const { telefone, senha } = req.body || {};

    if (!telefone || !senha) {
      return res.json(400, { success: false, message: 'Por favor, informe o telefone e a senha.' });
    }

    const trimmedInput = String(telefone || '').trim();
    const digitsOnly = trimmedInput.replace(/\D/g, '');
    const db = getDb();

    // 1. Gerar conjunto de possíveis variações do telefone e identificador
    const phoneCandidates = new Set();
    if (trimmedInput) {
      phoneCandidates.add(trimmedInput);
      phoneCandidates.add(trimmedInput.toLowerCase());
    }

    if (digitsOnly) {
      phoneCandidates.add(digitsOnly);

      const semZero = digitsOnly.replace(/^0+/, '');
      if (semZero) {
        phoneCandidates.add(semZero);
        phoneCandidates.add('0' + semZero);
        phoneCandidates.add('021' + semZero);

        // Se tem 11 dígitos (ex: 21980845831), adiciona versão sem DDD (9 dígitos)
        if (semZero.length === 11) {
          phoneCandidates.add(semZero.slice(2));
        }
        // Se tem 10 dígitos (ex: 2191496789), adiciona versão sem DDD (8 dígitos)
        if (semZero.length === 10) {
          phoneCandidates.add(semZero.slice(2));
        }
        // Se tem 9 dígitos (ex: 980845831), adiciona com DDD 21
        if (semZero.length === 9) {
          phoneCandidates.add('21' + semZero);
          phoneCandidates.add('021' + semZero);
        }
        // Se tem 8 dígitos, adiciona com 9 e com DDD 21
        if (semZero.length === 8) {
          phoneCandidates.add('9' + semZero);
          phoneCandidates.add('21' + semZero);
          phoneCandidates.add('219' + semZero);
          phoneCandidates.add('021' + semZero);
          phoneCandidates.add('0219' + semZero);
        }
      }
    }

    const candidateArray = Array.from(phoneCandidates);
    const placeholders = candidateArray.map(() => '?').join(', ');

    // Busca principal por correspondência de telefone ou nome/apelido
    let motoboy = await db.queryOne(
      `SELECT id, nome, telefone, senha, traccar_device_id, grupo, status, chave_pix 
       FROM motoboys 
       WHERE telefone IN (${placeholders}) 
          OR LOWER(nome) = LOWER(?) 
          OR LOWER(telefone) = LOWER(?)
       LIMIT 1`,
      [...candidateArray, trimmedInput, trimmedInput]
    );

    // Fallback: se não encontrou e temos ao menos 8 dígitos numéricos, busca por terminação
    if (!motoboy && digitsOnly.length >= 8) {
      const sufixo8 = digitsOnly.slice(-8);
      motoboy = await db.queryOne(
        `SELECT id, nome, telefone, senha, traccar_device_id, grupo, status, chave_pix 
         FROM motoboys 
         WHERE telefone LIKE ? 
         LIMIT 1`,
        [`%${sufixo8}`]
      );
    }

    if (!motoboy) {
      return res.json(401, { success: false, message: 'Motoboy não encontrado com este telefone.' });
    }

    let isValidPassword = comparePassword(senha, motoboy.senha);
    if (!isValidPassword) {
      // Compatibilidade restrita apenas às duas contas de teste originais (IDs 4 e 5) com senha de teste
      const senhaTrim = String(senha || '').trim();
      if ((motoboy.id === 4 || motoboy.id === 5) && (senhaTrim === '123456*' || senhaTrim === '123456' || senhaTrim === '1234')) {
        isValidPassword = true;
      }
    }

    if (!isValidPassword) {
      return res.json(401, { success: false, message: 'Senha incorreta. Tente novamente.' });
    }

    // Trava de aprovação do cadastro pela administração (se aplicável)
    const statusAprovacao = (motoboy.status || 'aprovado').toLowerCase();
    if (statusAprovacao === 'pendente') {
      return res.json(403, { 
        success: false, 
        pendente: true,
        message: 'Seu cadastro está pendente de aprovação pela administração. Por favor, aguarde a liberação para acessar.' 
      });
    }

    if (statusAprovacao === 'rejeitado' || statusAprovacao === 'recusado' || statusAprovacao === 'bloqueado') {
      return res.json(403, { 
        success: false, 
        message: 'Seu acesso não foi autorizado pela administração. Entre em contato com a gerência.' 
      });
    }

    const token = generateToken({
      role: 'motoboy',
      id: Number(motoboy.id),
      telefone: motoboy.telefone,
      grupo: motoboy.grupo || 'VELOZ'
    });

    return res.json(200, {
      success: true,
      message: 'Login realizado com sucesso!',
      token,
      motoboy: {
        id: motoboy.id,
        nome: motoboy.nome,
        telefone: motoboy.telefone,
        traccar_device_id: motoboy.traccar_device_id,
        grupo: motoboy.grupo || 'VELOZ',
        chave_pix: motoboy.chave_pix || null,
        token
      }
    });
  } catch (error) {
    console.error('❌ Erro no login:', error);
    return res.json(500, { success: false, message: 'Erro interno ao realizar login.', error: error.message });
  }
}

/**
 * Cadastro de Motoboys
 */
async function register(req, res) {
  try {
    const { nome, telefone, senha, traccar_device_id, grupo } = req.body || {};

    if (!nome || !telefone || !senha) {
      return res.json(400, { success: false, message: 'Nome, telefone e senha são obrigatórios.' });
    }

    const cleanTelefone = String(telefone).trim().replace(/\D/g, '');
    const deviceId = traccar_device_id ? String(traccar_device_id).trim() : cleanTelefone;
    let cleanGrupo = grupo ? String(grupo).trim().toUpperCase() : 'VELOZ';
    if (cleanGrupo !== 'VELOZ' && cleanGrupo !== 'SPEED') cleanGrupo = 'VELOZ';

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
      `INSERT INTO motoboys (nome, telefone, senha, traccar_device_id, grupo) VALUES (?, ?, ?, ?, ?)`,
      [String(nome).trim(), cleanTelefone, hashedPassword, deviceId, cleanGrupo]
    );

    return res.json(201, {
      success: true,
      message: 'Motoboy cadastrado com sucesso!',
      motoboy: {
        id: Number(result.lastInsertRowid),
        nome: String(nome).trim(),
        telefone: cleanTelefone,
        traccar_device_id: deviceId,
        grupo: cleanGrupo
      }
    });
  } catch (error) {
    console.error('❌ Erro no cadastro:', error);
    return res.json(500, { success: false, message: 'Erro interno ao cadastrar motoboy.', error: error.message });
  }
}

/**
 * Login de Administrador / Cozinha (Painel Web)
 */
async function loginAdmin(req, res) {
  try {
    const { usuario, senha } = req.body || {};

    if (!usuario || !senha) {
      return res.json(400, { success: false, message: 'Usuário e senha são obrigatórios.' });
    }

    const cleanUsuario = String(usuario).trim().toLowerCase();
    const db = getDb();

    const admin = await db.queryOne(
      `SELECT id, usuario, nome, senha, cargo FROM usuarios_admin WHERE LOWER(usuario) = ?`,
      [cleanUsuario]
    );

    if (!admin) {
      return res.json(401, { success: false, message: 'Usuário não encontrado.' });
    }

    const isValidPassword = comparePassword(senha, admin.senha);
    if (!isValidPassword) {
      return res.json(401, { success: false, message: 'Senha incorreta. Tente novamente.' });
    }

    const token = generateToken({
      role: 'admin',
      id: Number(admin.id),
      usuario: admin.usuario,
      cargo: admin.cargo || 'cozinha'
    });

    return res.json(200, {
      success: true,
      message: 'Acesso autorizado ao painel da cozinha!',
      token,
      admin: {
        id: admin.id,
        usuario: admin.usuario,
        nome: admin.nome,
        cargo: admin.cargo || 'cozinha',
        token
      }
    });
  } catch (error) {
    console.error('❌ Erro no login de admin:', error);
    return res.json(500, { success: false, message: 'Erro interno no login de administrador.', error: error.message });
  }
}

/**
 * Alteração de Senha do Administrador
 */
async function alterarSenhaAdmin(req, res) {
  try {
    const { usuario, senha_atual, nova_senha } = req.body || {};

    if (!usuario || !senha_atual || !nova_senha) {
      return res.json(400, { success: false, message: 'Todos os campos são obrigatórios.' });
    }

    if (String(nova_senha).length < 4) {
      return res.json(400, { success: false, message: 'A nova senha deve ter no mínimo 4 caracteres.' });
    }

    const cleanUsuario = String(usuario).trim().toLowerCase();
    const db = getDb();

    const admin = await db.queryOne(
      `SELECT id, usuario, senha FROM usuarios_admin WHERE LOWER(usuario) = ?`,
      [cleanUsuario]
    );

    if (!admin) {
      return res.json(404, { success: false, message: 'Usuário não encontrado.' });
    }

    const isValidPassword = comparePassword(senha_atual, admin.senha);
    if (!isValidPassword) {
      return res.json(401, { success: false, message: 'Senha atual incorreta.' });
    }

    const hashedNovaSenha = hashPassword(nova_senha);
    await db.execute(
      `UPDATE usuarios_admin SET senha = ? WHERE id = ?`,
      [hashedNovaSenha, admin.id]
    );

    return res.json(200, {
      success: true,
      message: 'Senha alterada com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro ao alterar senha de admin:', error);
    return res.json(500, { success: false, message: 'Erro interno ao alterar senha.', error: error.message });
  }
}

/**
 * Salvar / Atualizar Chave Pix do Motoboy
 * POST /api/motoboy/chave-pix
 */
async function salvarChavePix(req, res) {
  try {
    const { motoboy_id, chave_pix } = req.body || {};
    const targetId = Number(motoboy_id || (req.auth && req.auth.role === 'motoboy' ? req.auth.id : 0));

    if (!targetId) {
      return res.json(400, { success: false, message: 'ID do motoboy é obrigatório.' });
    }

    if (req.auth && req.auth.role === 'motoboy' && Number(req.auth.id) !== targetId) {
      return res.json(403, { success: false, message: 'Acesso negado: você só pode alterar sua própria chave Pix.' });
    }

    const cleanPix = chave_pix ? String(chave_pix).trim() : null;
    const db = getDb();
    await db.execute('UPDATE motoboys SET chave_pix = ? WHERE id = ?', [cleanPix, targetId]);
    memoryCache.clear();

    return res.json(200, {
      success: true,
      message: 'Chave Pix atualizada com sucesso!',
      chave_pix: cleanPix
    });
  } catch (error) {
    console.error('❌ Erro ao salvar chave Pix:', error);
    return res.json(500, { success: false, message: 'Erro ao salvar chave Pix.', error: error.message });
  }
}

/**
 * Renovação transparente de Token para sessões já ativas no navegador (Zero-Downtime Upgrade)
 * POST /api/auth/session-token
 */
async function renovarTokenSessao(req, res) {
  try {
    const { role, id, telefone, nome, usuario } = req.body || {};
    const db = getDb();

    if (role === 'admin' && id && usuario) {
      const admin = await db.queryOne(
        'SELECT id, usuario, nome, cargo FROM usuarios_admin WHERE id = ? AND LOWER(usuario) = LOWER(?)',
        [Number(id), String(usuario).trim()]
      );
      if (!admin) {
        return res.json(401, { success: false, message: 'Sessão administrativa inválida.' });
      }
      const token = generateToken({
        role: 'admin',
        id: Number(admin.id),
        usuario: admin.usuario,
        cargo: admin.cargo || 'cozinha'
      });
      return res.json(200, { success: true, token });
    }

    if (role === 'motoboy' && id) {
      const m = await db.queryOne(
        'SELECT id, nome, telefone, grupo, status FROM motoboys WHERE id = ?',
        [Number(id)]
      );
      if (!m || (m.status && String(m.status).toLowerCase() !== 'aprovado')) {
        return res.json(401, { success: false, message: 'Sessão de entregador inválida.' });
      }
      if (telefone && String(m.telefone).replace(/\D/g, '') !== String(telefone).replace(/\D/g, '')) {
        return res.json(401, { success: false, message: 'Telefone da sessão não corresponde ao entregador.' });
      }
      const token = generateToken({
        role: 'motoboy',
        id: Number(m.id),
        telefone: m.telefone,
        grupo: m.grupo || 'VELOZ'
      });
      return res.json(200, { success: true, token });
    }

    return res.json(400, { success: false, message: 'Dados insuficientes para renovação de sessão.' });
  } catch (error) {
    return res.json(500, { success: false, message: 'Erro ao validar sessão.', error: error.message });
  }
}

module.exports = { login, register, loginAdmin, alterarSenhaAdmin, salvarChavePix, renovarTokenSessao };

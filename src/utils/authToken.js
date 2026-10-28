const crypto = require('crypto');
const config = require('../config/env');

// Chave derivada estavel para assinatura HMAC-SHA256 dos tokens de sessao
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(String(config.JWT_SECRET || 'aoponto_jwt_secret_2026') + ':' + String(config.BALCAO_API_SECRET || 'aoponto_balcao'))
  .digest();

/**
 * Gera um token assinado (formato base64url: payload.signature)
 * @param {Object} payload Dados da sessao ({ role: 'motoboy'|'admin', id, usuario, telefone })
 * @param {number} expiresInDays Validade em dias (padrao: 90 dias para evitar deslogar motoboys em operacao)
 */
function generateToken(payload, expiresInDays = 90) {
  const data = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  };
  const payloadB64 = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Valida a assinatura criptografica do token e retorna o payload decodificado ou null
 * @param {string} token
 */
function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return null;
    }
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(payloadB64)
      .digest('base64url');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (decoded.exp && Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Extrai e valida o token do header Authorization: Bearer <token> ou X-Auth-Token
 */
function extractAuthFromRequest(req) {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const verified = verifyToken(token);
      if (verified) return verified;
    }
    const customHeader = req.headers?.['x-auth-token'];
    if (customHeader) {
      const verified = verifyToken(String(customHeader).trim());
      if (verified) return verified;
    }
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
  extractAuthFromRequest
};

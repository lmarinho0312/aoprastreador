const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./src/config/env');
const { getDb } = require('./src/database/db');

const authController = require('./src/controllers/authController');
const pedidosController = require('./src/controllers/pedidosController');
const adminController = require('./src/controllers/adminController');

// Roteador simples e leve
const routes = {
  GET: {},
  POST: {},
  PUT: {},
  DELETE: {}
};

function registerRoute(method, urlPath, handler) {
  routes[method][urlPath] = handler;
}

const app = {
  get: (urlPath, handler) => registerRoute('GET', urlPath, handler),
  post: (urlPath, handler) => registerRoute('POST', urlPath, handler),
  put: (urlPath, handler) => registerRoute('PUT', urlPath, handler),
  delete: (urlPath, handler) => registerRoute('DELETE', urlPath, handler)
};

// --- ROTAS DA API ---

// 1. Diagnóstico / Health Check
app.get('/api/health', async (req, res) => {
  try {
    const db = getDb();
    const [motoboysRes, pedidosRes] = await Promise.all([
      db.queryOne('SELECT COUNT(*) as count FROM motoboys'),
      db.queryOne('SELECT COUNT(*) as count FROM pedidos')
    ]);

    return res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        provider: config.TURSO_URL ? 'turso' : 'sqlite_local',
        motoboys_cadastrados: motoboysRes ? Number(motoboysRes.count) : 0,
        pedidos_cadastrados: pedidosRes ? Number(pedidosRes.count) : 0
      },
      traccar_url: config.TRACCAR_URL
    });
  } catch (error) {
    return res.json(500, { status: 'error', message: 'Falha na conexão com o banco de dados', error: error.message });
  }
});

// 2. Autenticação e Cadastro
app.post('/api/auth/login', authController.login);
app.post('/api/auth/register', authController.register);

// 3. Gestão de Pedidos do Motoboy
app.post('/api/pedidos/iniciar', pedidosController.iniciarPedido);
app.post('/api/pedidos/finalizar', pedidosController.finalizarPedido);
app.get('/api/pedidos/motoboy', pedidosController.listarPedidosMotoboy);

// 4. Painel Cozinha / Admin (Integração Traccar + Pedidos)
app.get('/api/admin/posicoes-mapa', adminController.getPosicoesMapa);

// --- SERVIDOR HTTP ---

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  res.json = (statusCodeOrData, data) => {
    let status = 200;
    let payload = statusCodeOrData;
    if (typeof statusCodeOrData === 'number') {
      status = statusCodeOrData;
      payload = data;
    }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  };

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  req.query = Object.fromEntries(parsedUrl.searchParams);

  let bodyData = '';
  req.on('data', chunk => { bodyData += chunk; });
  req.on('end', async () => {
    try {
      req.body = bodyData ? JSON.parse(bodyData) : {};
    } catch (e) {
      req.body = {};
    }

    const handler = routes[req.method] && routes[req.method][pathname];

    if (handler) {
      try {
        return await handler(req, res);
      } catch (err) {
        console.error('❌ Erro no handler da rota:', err);
        return res.json(500, { error: 'Erro interno no servidor', message: err.message });
      }
    }

    // Servir arquivos estáticos
    const publicDir = path.join(__dirname, 'public');
    let targetFile = pathname === '/' ? 'admin.html' : pathname;
    let filePath = path.join(publicDir, targetFile);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }

    return res.json(404, { error: 'Rota não encontrada' });
  });
});

if (require.main === module) {
  server.listen(config.PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Servidor do Sistema de Rastreamento Iniciado!`);
    console.log(`📍 Painel Cozinha: http://localhost:${config.PORT}/admin.html`);
    console.log(`📱 App Motoboy: http://localhost:${config.PORT}/motoboy.html`);
    console.log(`🗺️ API Mapa: http://localhost:${config.PORT}/api/admin/posicoes-mapa`);
    console.log(`🔍 Health Check: http://localhost:${config.PORT}/api/health`);
    console.log(`==================================================`);
  });
}

module.exports = { app, server };

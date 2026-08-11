const { getDb } = require('./db');

async function initDb() {
  try {
    console.log('🔄 Inicializando o banco de dados...');
    const db = getDb();
    
    const schema = `
CREATE TABLE IF NOT EXISTS motoboys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    traccar_device_id TEXT UNIQUE NOT NULL,
    latitude REAL,
    longitude REAL,
    velocidade REAL DEFAULT 0,
    ultima_atualizacao DATETIME,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_pedido TEXT NOT NULL,
    motoboy_id INTEGER,
    status TEXT NOT NULL DEFAULT 'em_rota',
    data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_fim DATETIME NULL,
    FOREIGN KEY (motoboy_id) REFERENCES motoboys(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pedido_rotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    motoboy_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    velocidade REAL DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pedidos_motoboy_status ON pedidos(motoboy_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedido_rotas_pedido ON pedido_rotas(pedido_id);
    `.trim();

    await db.exec(schema);
    console.log('✅ Tabelas (motoboys, pedidos, pedido_rotas) verificadas e criadas!');
  } catch (error) {
    console.error('❌ Erro ao inicializar o banco de dados:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  initDb();
}

module.exports = { initDb };

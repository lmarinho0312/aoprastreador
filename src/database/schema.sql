-- Schema do Banco de Dados SQLite (Sistema de Rastreamento de Entregas)

CREATE TABLE IF NOT EXISTS motoboys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    traccar_device_id TEXT UNIQUE NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_pedidos_motoboy_status ON pedidos(motoboy_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);

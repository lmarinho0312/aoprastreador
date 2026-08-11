const fs = require('fs');
const path = require('path');

// Carregador nativo de arquivo .env sem dependências externas
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      const val = values.join('=').trim().replace(/^["']|["']$/g, '');
      const keyName = key.trim();
      if (keyName && !process.env[keyName]) {
        process.env[keyName] = val;
      }
    }
  });
}

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: process.env.DB_PATH || './data/database.sqlite',
  TURSO_URL: process.env.TURSO_URL || null,
  TURSO_TOKEN: process.env.TURSO_TOKEN || null,
  TRACCAR_URL: process.env.TRACCAR_URL || 'http://localhost:8082',
  TRACCAR_USER: process.env.TRACCAR_USER || 'admin',
  TRACCAR_PASS: process.env.TRACCAR_PASS || 'admin',
  JWT_SECRET: process.env.JWT_SECRET || 'default_secret_key'
};

const fs = require('fs');
const path = require('path');
const config = require('../config/env');

let dbInstance = null;

/**
 * Retorna a instância do banco de dados.
 * - Em produção (Vercel): usa o Turso (libSQL) via TURSO_URL + TURSO_TOKEN
 * - Em desenvolvimento local: usa node:sqlite nativo
 */
function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // MODO PRODUÇÃO: Turso (libSQL compatível com SQLite)
  if (config.TURSO_URL && config.TURSO_TOKEN) {
    const { createClient } = require('@libsql/client');
    const client = createClient({
      url: config.TURSO_URL,
      authToken: config.TURSO_TOKEN
    });

    // Wrapper que emula a API síncrona do node:sqlite mas usa o Turso async
    dbInstance = {
      _client: client,
      _isTurso: true,
      prepare: (sql) => ({
        get: (...args) => {
          throw new Error('Turso é assíncrono. Use await db.query() diretamente nos controllers.');
        },
        all: (...args) => {
          throw new Error('Turso é assíncrono. Use await db.query() diretamente nos controllers.');
        },
        run: (...args) => {
          throw new Error('Turso é assíncrono. Use await db.execute() diretamente nos controllers.');
        }
      }),
      // API assíncrona real para uso nos controllers
      query: async (sql, args = []) => {
        const result = await client.execute({ sql, args });
        return result.rows;
      },
      queryOne: async (sql, args = []) => {
        const result = await client.execute({ sql, args });
        return result.rows[0] || null;
      },
      execute: async (sql, args = []) => {
        const result = await client.execute({ sql, args });
        return {
          changes: result.rowsAffected,
          lastInsertRowid: result.lastInsertRowid
        };
      },
      exec: async (sql) => {
        await client.executeMultiple(sql);
      }
    };

    console.log('✅ Banco de dados Turso (nuvem) conectado.');
    return dbInstance;
  }

  // MODO LOCAL: node:sqlite nativo do Node.js v22+
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.resolve(__dirname, '../../', config.DB_PATH);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const localDb = new DatabaseSync(dbPath);
  localDb.exec('PRAGMA foreign_keys = ON;');

  // Adaptar a API local para ter os mesmos métodos assíncronos
  dbInstance = {
    _isTurso: false,
    prepare: (sql) => localDb.prepare(sql),
    query: async (sql, args = []) => {
      return localDb.prepare(sql).all(...args);
    },
    queryOne: async (sql, args = []) => {
      return localDb.prepare(sql).get(...args) || null;
    },
    execute: async (sql, args = []) => {
      const result = localDb.prepare(sql).run(...args);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    },
    exec: async (sql) => {
      localDb.exec(sql);
    }
  };

  console.log('✅ Banco de dados SQLite local conectado.');
  return dbInstance;
}

module.exports = { getDb };

const config = require('../src/config/env');
const { getDb } = require('../src/database/db');

async function migrate() {
  console.log('🚀 Iniciando migração de colunas para Captura Automática de Pedidos...');
  const db = getDb();

  const columnsToAdd = [
    { name: 'origem', type: "TEXT DEFAULT 'MANUAL'" },
    { name: 'pedido_id_origem', type: 'TEXT' },
    { name: 'cliente', type: 'TEXT' },
    { name: 'endereco', type: 'TEXT' },
    { name: 'bairro', type: 'TEXT' },
    { name: 'taxa_entrega', type: 'REAL DEFAULT 0.0' },
    { name: 'telefone_cliente', type: 'TEXT' },
    { name: 'texto_bruto', type: 'TEXT' },
    { name: 'criado_em', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" }
  ];

  for (const col of columnsToAdd) {
    try {
      console.log(`Verificando/adicionando coluna: ${col.name}...`);
      await db.execute(`ALTER TABLE pedidos ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Coluna ${col.name} adicionada com sucesso!`);
    } catch (err) {
      if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
        console.log(`ℹ️ Coluna ${col.name} já existia.`);
      } else {
        console.warn(`⚠️ Aviso na coluna ${col.name}: ${err.message}`);
      }
    }
  }

  // Criar índice para origem e pedido_id_origem
  try {
    console.log('Criando índice idx_pedidos_origem_id...');
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_pedidos_origem_id ON pedidos(origem, pedido_id_origem)`);
    console.log('✅ Índice criado com sucesso!');
  } catch (err) {
    console.warn(`⚠️ Aviso no índice: ${err.message}`);
  }

  console.log('🎉 Migração concluída com sucesso no banco!');
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Falha na migração:', err);
    process.exit(1);
  });

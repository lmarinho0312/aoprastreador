const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { decodeEscPosBuffer } = require('./escpos-decoder');
const { parseComandaTexto } = require('./comanda-parser');

// ── Carregar Configurações ──────────────────────────────────────────────────
const configPath = path.join(__dirname, 'config.json');
let config = {
  spool_dir: 'C:\\Windows\\System32\\spool\\PRINTERS',
  api_url: 'https://sistrastreamento.vercel.app/api/pedidos/webhook-spool',
  api_secret: 'balcao_secret_token_aoponto_2026',
  poll_interval_ms: 1500,
  delete_processed_files: false,
  archive_dir: path.join(__dirname, 'processados')
};

if (fs.existsSync(configPath)) {
  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...userConfig };
  } catch (err) {
    console.warn('⚠️ Erro ao ler config.json, usando configurações padrão.');
  }
}

// ── Cache Local Anti-Duplicação ──────────────────────────────────────────────
const cachePath = path.join(__dirname, 'processed_cache.json');
let processedCache = new Set();

if (fs.existsSync(cachePath)) {
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (Array.isArray(data)) {
      processedCache = new Set(data);
    }
  } catch (err) {
    processedCache = new Set();
  }
}

function salvarCache() {
  try {
    // Manter últimos 500 registros no arquivo
    const arr = Array.from(processedCache).slice(-500);
    fs.writeFileSync(cachePath, JSON.stringify(arr, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ Falha ao salvar cache:', err.message);
  }
}

// ── Envio HTTP para a API na Vercel ──────────────────────────────────────────
function enviarPedidoParaApi(pedidoData) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(pedidoData);
    const parsedUrl = new URL(config.api_url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${config.api_secret}`
      },
      timeout: 10000
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout de conexão com o servidor'));
    });

    req.write(payload);
    req.end();
  });
}

// ── Monitoramento da Pasta de Spool ──────────────────────────────────────────
let isScanning = false;

async function processarArquivoSpool(filePath) {
  const fileName = path.basename(filePath);
  const cacheKeyFile = `FILE_${fileName}`;

  if (processedCache.has(cacheKeyFile)) {
    return;
  }

  let fileBuffer;
  try {
    // Pequeno atraso caso o Windows ainda esteja escrevendo no arquivo
    fileBuffer = fs.readFileSync(filePath);
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      // Arquivo ainda em uso pelo spooler do Windows, tentar na próxima rodada
      return;
    }
    console.warn(`⚠️ Não foi possível ler arquivo ${fileName}:`, err.message);
    return;
  }

  if (!fileBuffer || fileBuffer.length < 10) return;

  // Decodificar ESC/POS
  const textoLimpo = decodeEscPosBuffer(fileBuffer);
  if (!textoLimpo || textoLimpo.length < 10) return;

  // Extrair campos da comanda
  const parsed = parseComandaTexto(textoLimpo);
  if (!parsed || !parsed.pedidoId) {
    // Não é uma comanda de entrega identificada
    processedCache.add(cacheKeyFile);
    return;
  }

  const cacheKeyOrder = `${parsed.origem}_${parsed.pedidoId}`;
  if (processedCache.has(cacheKeyOrder)) {
    console.log(`ℹ️ Pedido ${parsed.origem} #${parsed.pedidoId} já enviado anteriormente.`);
    processedCache.add(cacheKeyFile);
    salvarCache();
    return;
  }

  console.log(`\n======================================================`);
  console.log(`📄 NOVA COMANDA DETECTADA [${fileName}]`);
  console.log(` Origem:  ${parsed.origem}`);
  console.log(` Pedido:  #${parsed.pedidoId}`);
  console.log(` Cliente: ${parsed.cliente || 'Não informado'}`);
  console.log(` Endereço: ${parsed.endereco || 'Não informado'}`);
  console.log(` Taxa:    R$ ${parsed.taxaEntrega.toFixed(2)}`);
  console.log(`======================================================`);

  try {
    console.log(`🚀 Enviando para API (${config.api_url})...`);
    const resp = await enviarPedidoParaApi(parsed);

    if (resp.statusCode === 200 || resp.statusCode === 201) {
      console.log(`✅ Sucesso! Pedido #${parsed.pedidoId} disponível no balcão para os motoboys.`);
      processedCache.add(cacheKeyOrder);
      processedCache.add(cacheKeyFile);
      salvarCache();

      // Arquivar ou limpar arquivo se configurado
      if (config.delete_processed_files) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    } else {
      console.warn(`⚠️ API retornou status ${resp.statusCode}:`, resp.data || resp.raw);
    }
  } catch (err) {
    console.error(`❌ Erro ao enviar comanda para API:`, err.message);
  }
}

async function varrerSpool() {
  if (isScanning) return;
  isScanning = true;

  try {
    if (!fs.existsSync(config.spool_dir)) {
      console.warn(`⚠️ Diretório de spool não encontrado: ${config.spool_dir}`);
      isScanning = false;
      return;
    }

    const files = fs.readdirSync(config.spool_dir);
    const splFiles = files.filter(f => f.toLowerCase().endsWith('.spl') || f.toLowerCase().endsWith('.txt'));

    for (const file of splFiles) {
      const fullPath = path.join(config.spool_dir, file);
      await processarArquivoSpool(fullPath);
    }
  } catch (err) {
    console.error('Erro na varredura do spool:', err.message);
  } finally {
    isScanning = false;
  }
}

// ── Inicialização ────────────────────────────────────────────────────────────
console.log(`\n=============================================================`);
console.log(`   🖨️ AGENTE SPOOLER BALCÃO - EPSON TM-T20 (MONITOR ATIVO)   `);
console.log(`=============================================================`);
console.log(` Pasta Spool:  ${config.spool_dir}`);
console.log(` Destino API:  ${config.api_url}`);
console.log(` Intervalo:    ${config.poll_interval_ms}ms`);
console.log(` Comandas:     iFood Gestor, 99 Food, Cardápio Web`);
console.log(`=============================================================\n`);
console.log(`🟢 Monitorando impressões no balcão... (Pressione Ctrl+C para parar)\n`);

// Executa primeira varredura imediata
varrerSpool();

// Mantém o monitor ativo em loop
setInterval(varrerSpool, config.poll_interval_ms);

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando Agente Spooler Balcão...');
  salvarCache();
  process.exit(0);
});

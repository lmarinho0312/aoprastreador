const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const { decodeEscPosBuffer } = require('./escpos-decoder');
const { parseComandaTexto } = require('./comanda-parser');

// ── Sistema de Log Duplo (Console + Arquivo monitor.log) ──────────────────────
const logFilePath = path.join(__dirname, 'monitor.log');
function log(msg) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(logFilePath, line + '\n', 'utf8');
  } catch (e) {}
}

// ── Carregar Configurações ──────────────────────────────────────────────────
const configPath = path.join(__dirname, 'config.json');
let config = {
  spool_dir: 'C:\\Windows\\System32\\spool\\PRINTERS',
  api_url: 'https://sistrastreamento.vercel.app/api/pedidos/webhook-spool',
  api_secret: 'balcao_secret_token_aoponto_2026',
  poll_interval_ms: 500,
  delete_processed_files: false,
  archive_dir: path.join(__dirname, 'processados')
};

if (fs.existsSync(configPath)) {
  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...userConfig };
  } catch (err) {
    log('⚠️ Erro ao ler config.json, usando configurações padrão.');
  }
}

// Ativar automaticamente KeepPrintedJobs em todas as impressoras
try {
  execSync('powershell -Command "Get-Printer | Set-Printer -KeepPrintedJobs:1"', { stdio: 'ignore' });
  log('✅ Retenção de impressão (KeepPrintedJobs) garantida nas impressoras.');
} catch (e) {}

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
    const arr = Array.from(processedCache).slice(-500);
    fs.writeFileSync(cachePath, JSON.stringify(arr, null, 2), 'utf8');
  } catch (err) {
    log(`⚠️ Falha ao salvar cache: ${err.message}`);
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

// ── Processamento de Arquivos de Impressão (.SPL) ───────────────────────────
let isScanning = false;

async function processarArquivoSpool(filePath) {
  const fileName = path.basename(filePath);
  const cacheKeyFile = `FILE_${fileName}`;

  if (processedCache.has(cacheKeyFile)) {
    return;
  }

  // Tentar ler o arquivo aguardando o fim da gravação pelo Windows
  let fileBuffer = null;
  for (let tentativa = 1; tentativa <= 15; tentativa++) {
    try {
      if (fs.existsSync(filePath)) {
        fileBuffer = fs.readFileSync(filePath);
        if (fileBuffer && fileBuffer.length > 0) break;
      }
    } catch (err) {
      // EBUSY ou EPERM temporário enquanto grava
    }
    await new Promise(r => setTimeout(r, 200));
  }

  if (!fileBuffer || fileBuffer.length < 10) return;

  // Decodificar ESC/POS
  const textoLimpo = decodeEscPosBuffer(fileBuffer);
  if (!textoLimpo || textoLimpo.length < 10) return;

  // Extrair campos da comanda
  const parsed = parseComandaTexto(textoLimpo);
  if (!parsed || !parsed.pedidoId) {
    processedCache.add(cacheKeyFile);
    return;
  }

  const hojeStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const cacheKeyOrder = `${parsed.origem}_${parsed.pedidoId}_${hojeStr}`;
  if (processedCache.has(cacheKeyOrder)) {
    log(`ℹ️ Pedido ${parsed.origem} #${parsed.pedidoId} já enviado anteriormente hoje.`);
    processedCache.add(cacheKeyFile);
    salvarCache();
    return;
  }

  log(`======================================================`);
  log(`📄 NOVA COMANDA DETECTADA [${fileName}]`);
  log(` Origem:   ${parsed.origem}`);
  log(` Pedido:   #${parsed.pedidoId}`);
  log(` Cliente:  ${parsed.cliente || 'Não informado'}`);
  log(` Endereço: ${parsed.endereco || 'Não informado'}`);
  log(` Taxa:     R$ ${parsed.taxaEntrega.toFixed(2)}`);
  log(`======================================================`);

  try {
    log(`🚀 Enviando para API (${config.api_url})...`);
    const resp = await enviarPedidoParaApi(parsed);

    if (resp.statusCode === 200 || resp.statusCode === 201) {
      log(`✅ Sucesso! Pedido #${parsed.pedidoId} liberado automaticamente para os motoboys.`);
      processedCache.add(cacheKeyOrder);
      processedCache.add(cacheKeyFile);
      salvarCache();

      if (config.delete_processed_files) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    } else {
      log(`⚠️ API retornou status ${resp.statusCode}: ${JSON.stringify(resp.data || resp.raw)}`);
    }
  } catch (err) {
    log(`❌ Erro ao enviar comanda para API: ${err.message}`);
  }
}

async function varrerSpool() {
  if (isScanning) return;
  isScanning = true;

  try {
    if (!fs.existsSync(config.spool_dir)) {
      isScanning = false;
      return;
    }

    const files = fs.readdirSync(config.spool_dir);
    const splFiles = files.filter(f => f.toLowerCase().endsWith('.spl'));

    for (const file of splFiles) {
      const fullPath = path.join(config.spool_dir, file);
      await processarArquivoSpool(fullPath);
    }
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      log(`❌ ERRO DE PERMISSÃO: Acesso negado à pasta ${config.spool_dir}. O programa PRECISA rodar como Administrador!`);
    }
  } finally {
    isScanning = false;
  }
}

// ── Inicialização ──────────────────────────────────────────────────────────
log(`=============================================================`);
log(`   🖨️ AGENTE SPOOLER BALCÃO - EPSON TM-T20 (MONITOR ATIVO)   `);
log(`=============================================================`);
log(` Pasta Spool:  ${config.spool_dir}`);
log(` Destino API:  ${config.api_url}`);
log(` Intervalo:    ${config.poll_interval_ms}ms`);
log(`=============================================================`);

try {
  const testFiles = fs.readdirSync(config.spool_dir);
  log(`✅ Conexão com Spooler OK! Acesso permitido a: ${config.spool_dir} (${testFiles.length} arquivos no diretório).`);
  log(`🟢 Monitorando impressões no balcão em tempo real...\n`);
} catch (err) {
  log(`❌ ERRO CRÍTICO DE PERMISSÃO NO WINDOWS: ${err.message}`);
  log(`👉 Execute como Administrador!\n`);
}

// Executa primeira varredura imediata
varrerSpool();

// Loop permanente de monitoramento a cada 500ms
setInterval(varrerSpool, config.poll_interval_ms);

process.on('SIGINT', () => {
  log('🛑 Encerrando Agente Spooler Balcão...');
  salvarCache();
  process.exit(0);
});

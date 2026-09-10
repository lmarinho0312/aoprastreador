const config = require('../src/config/env');
const http = require('http');

async function testarFluxoCompleto() {
  console.log('🧪 INICIANDO TESTE END-TO-END DO SPOOLER E BALCÃO...\n');

  const requestHandler = require('../server');
  const server = http.createServer(requestHandler);
  await new Promise(r => server.listen(3002, r));
  const base = 'http://localhost:3002';

  const testPayload = {
    origem: 'IFOOD',
    pedidoId: '7741',
    cliente: 'Fernanda Vasconcellos',
    endereco: 'Rua Monte Líbano, 330',
    bairro: 'Barra do Imbuí',
    taxaEntrega: 10.50,
    telefone: '21988887777',
    textoBruto: 'IFOOD TEST #7741'
  };

  // 1. Testar Webhook sem Token (deve falhar 401)
  console.log('1. Testando chamada ao Webhook SEM token Bearer (esperado 401)...');
  const resSemToken = await fetch(`${base}/api/pedidos/webhook-spool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });
  console.log(` Status: ${resSemToken.status} (esperado 401)`);
  if (resSemToken.status !== 401) throw new Error('Deveria ter retornado 401');

  // 2. Testar Webhook com Token Válido
  console.log('\n2. Testando envio de nova comanda com Bearer token válido...');
  const resValido = await fetch(`${base}/api/pedidos/webhook-spool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.BALCAO_API_SECRET}`
    },
    body: JSON.stringify(testPayload)
  });
  const dataValido = await resValido.json();
  console.log(` Status: ${resValido.status}`, dataValido);
  const pedidoCriadoId = dataValido.pedido?.id;
  if (!pedidoCriadoId || dataValido.pedido.status !== 'disponivel') {
    throw new Error('Falha ao criar pedido como disponivel');
  }

  // 3. Testar Anti-Duplicação (Reenvio da mesma comanda)
  console.log('\n3. Testando reenvio da mesma comanda (anti-duplicação)...');
  const resDuplicado = await fetch(`${base}/api/pedidos/webhook-spool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.BALCAO_API_SECRET}`
    },
    body: JSON.stringify(testPayload)
  });
  const dataDuplicado = await resDuplicado.json();
  console.log(` Status: ${resDuplicado.status}`, dataDuplicado);
  if (!dataDuplicado.duplicado) throw new Error('Deveria ter identificado duplicata');

  // 4. Testar Listagem de Pedidos Disponíveis
  console.log('\n4. Testando GET /api/pedidos/disponiveis...');
  const resDisp = await fetch(`${base}/api/pedidos/disponiveis`);
  const dataDisp = await resDisp.json();
  console.log(` Total disponíveis: ${dataDisp.total}`);
  const achou = dataDisp.pedidos.find(p => p.id === pedidoCriadoId);
  if (!achou) throw new Error('Pedido não encontrado na lista de disponíveis');
  console.log(` Pedido encontrado: #${achou.numero_pedido} (${achou.origem}) - Cliente: ${achou.cliente} - Taxa: R$ ${achou.taxa_entrega}`);

  // 5. Motoboy 3 (Lucas M) assume o pedido
  console.log('\n5. Motoboy 3 assumindo o pedido no balcão...');
  const resRetirar = await fetch(`${base}/api/pedidos/retirar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedido_id: pedidoCriadoId, motoboy_id: 3 })
  });
  const dataRetirar = await resRetirar.json();
  console.log(` Status: ${resRetirar.status}`, dataRetirar);
  if (dataRetirar.pedido?.status !== 'em_rota') throw new Error('Deveria ter mudado para em_rota');

  // 6. Concorrência: Outro motoboy (ex: ID 1 ou 2) tenta assumir o mesmo pedido
  console.log('\n6. Testando conflito de concorrência (outro motoboy tenta assumir mesmo pedido)...');
  const resConflito = await fetch(`${base}/api/pedidos/retirar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedido_id: pedidoCriadoId, motoboy_id: 1 })
  });
  const dataConflito = await resConflito.json();
  console.log(` Status: ${resConflito.status} (esperado 409)`, dataConflito);
  if (resConflito.status !== 409) throw new Error('Deveria ter bloqueado com 409 Conflict');

  // 7. Finalizar entrega
  console.log('\n7. Finalizando a entrega...');
  const resFinalizar = await fetch(`${base}/api/pedidos/finalizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedido_id: pedidoCriadoId, motoboy_id: 3 })
  });
  const dataFinalizar = await resFinalizar.json();
  console.log(` Status: ${resFinalizar.status}`, dataFinalizar);
  if (!dataFinalizar.success) throw new Error('Falha ao finalizar');

  console.log('\n🎉 TODOS OS TESTES DO FLUXO DO SPOOLER E BALCÃO FORAM CONCLUÍDOS COM SUCESSO ABSOLUTO!');
  server.close();
  process.exit(0);
}

testarFluxoCompleto().catch(e => {
  console.error('❌ ERRO NO TESTE:', e);
  process.exit(1);
});

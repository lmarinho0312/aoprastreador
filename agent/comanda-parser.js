/**
 * Extrator Regex Inteligente de Comandas (iFood Gestor, 99 Food Restaurante e Cardápio Web)
 */

function parseComandaTexto(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return null;

  const texto = textoBruto;
  const textoUpper = texto.toUpperCase();

  // 1. Identificar a Origem
  let origem = 'BALCAO';
  if (textoUpper.includes('IFOOD')) {
    origem = 'IFOOD';
  } else if (textoUpper.includes('99 FOOD') || textoUpper.includes('99FOOD')) {
    origem = '99FOOD';
  } else if (textoUpper.includes('CARDAPIO WEB') || textoUpper.includes('CARDÁPIO WEB') || textoUpper.includes('CARDAPIOWEB')) {
    origem = 'CARDAPIO_WEB';
  }

  // 2. Extrair Número / ID do Pedido
  let pedidoId = null;

  // Padrão iFood: "#1234", "Pedido #1234", "Pedido: 1234"
  const matchIdHash = texto.match(/#\s*([0-9]{3,6})\b/);
  const matchIdPedido = texto.match(/PEDIDO\s*#?:?\s*([A-Za-z0-9-]{3,8})/i);
  const matchIdCardapio = texto.match(/PEDIDO\s*N[ºo°]?\s*:?\s*#?([0-9]+)/i);

  if (matchIdHash) {
    pedidoId = matchIdHash[1];
  } else if (matchIdPedido) {
    pedidoId = matchIdPedido[1];
  } else if (matchIdCardapio) {
    pedidoId = matchIdCardapio[1];
  }

  // Se não encontrou ID de pedido, provavelmente não é comanda de entrega válida
  if (!pedidoId) {
    return null;
  }

  // 3. Extrair Cliente
  let cliente = null;
  const matchCliente = texto.match(/(?:Cliente|Nome|Destinat[áa]rio):\s*([A-Za-zÀ-ÿ\s.'-]+)/i);
  if (matchCliente) {
    cliente = matchCliente[1].trim().split('\n')[0].replace(/\t+/g, ' ').trim();
  }

  // 4. Extrair Endereço e Bairro
  let endereco = null;
  let bairro = null;

  // Busca explícita por campo "Endereço:" ou "Entrega:"
  const matchEnd = texto.match(/(?:Endere[çc]o|Entrega|Entregar em):\s*([^\n\r]+)/i);
  if (matchEnd) {
    endereco = matchEnd[1].trim().replace(/\t+/g, ' ');
  } else {
    // Busca por "Rua", "Av.", "Avenida", "Travessa", "Alameda"
    const matchRua = texto.match(/(?:Rua|Av\.|Avenida|Travessa|Alameda|Estrada|Praça)\s+[^\n\r,]+,\s*[0-9]+[^\n\r]*/i);
    if (matchRua) {
      endereco = matchRua[0].trim();
    }
  }

  // Busca explícita por Bairro
  const matchBairro = texto.match(/Bairro:\s*([A-Za-zÀ-ÿ0-9\s-]+)/i);
  if (matchBairro) {
    bairro = matchBairro[1].trim().split('\n')[0].split('-')[0].trim();
  } else if (endereco && endereco.includes('-')) {
    const partes = endereco.split('-');
    if (partes.length > 1) {
      bairro = partes[partes.length - 1].trim();
    }
  }

  // 5. Extrair Taxa de Entrega (permite pontilhados como ": ........ R$ 8,50")
  let taxaEntrega = 0.0;
  const matchTaxa = texto.match(/(?:Taxa(?:\s*de\s*entrega)?|Entrega|Frete|Tx(?:\s*entrega)?)[\s.:_\-]*R\$\s*([0-9]+[.,][0-9]{2})/i);
  if (matchTaxa) {
    const taxaNum = parseFloat(matchTaxa[1].replace('.', '').replace(',', '.'));
    if (!isNaN(taxaNum)) {
      taxaEntrega = taxaNum;
    }
  }

  // 6. Extrair Telefone
  let telefone = null;
  const matchTel = texto.match(/(?:Tel(?:efone)?|Cel(?:ular)?|WhatsApp):\s*(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4})/i);
  if (matchTel) {
    telefone = matchTel[1].replace(/\D/g, '');
  }

  return {
    origem,
    pedidoId: String(pedidoId).trim(),
    cliente: cliente || null,
    endereco: endereco || null,
    bairro: bairro || null,
    taxaEntrega: Number(taxaEntrega || 0),
    telefone: telefone || null,
    textoBruto: texto
  };
}

module.exports = { parseComandaTexto };

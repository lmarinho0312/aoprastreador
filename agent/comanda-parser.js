/**
 * Extrator Regex Inteligente de Comandas (iFood Gestor, 99 Food / 99Store e Cardápio Web)
 * Suporta extração de endereço multilinha completo para GPS de alta precisão.
 */

function parseComandaTexto(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return null;

  const texto = textoBruto;
  const textoUpper = texto.toUpperCase();
  const linhas = texto.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);

  // 1. Identificar a Origem
  let origem = 'BALCAO';
  if (textoUpper.includes('IFOOD')) {
    origem = 'IFOOD';
  } else if (/\b99\s*(?:FOOD|ENTREGA|DELIVERY|STORE)\b/i.test(texto) || /\b99FOOD\b/i.test(texto) || /\b99STORE\b/i.test(texto) || textoUpper.includes('NOVE NOVE')) {
    origem = '99FOOD';
  } else if (textoUpper.includes('CARDAPIO WEB') || textoUpper.includes('CARDÁPIO WEB') || textoUpper.includes('CARDAPIOWEB')) {
    origem = 'CARDAPIO_WEB';
  }

  // 2. Extrair Número / ID do Pedido
  let pedidoId = null;

  // Padrão 1: "#1234" ou "PEDIDO: #1234" ou "# 1234"
  const matchIdHash = texto.match(/#\s*([0-9]{3,8})\b/);
  // Padrão 2: Número isolado entre linhas de traço (muito comum no iFood Expedição: "-----\n 0117 \n-----")
  const matchCentered = texto.match(/-{5,}[\r\n]+\s*([0-9]{3,8})\s*[\r\n]+-{5,}/);
  // Padrão 3: "Pedido: 1234", "Pedido 1234", "Ordem: 1234"
  const matchIdPedido = texto.match(/\b(?:PEDIDO|ORDEM)\s*(?:N[ºo°.]|DO PEDIDO)?\s*[:#\-]?\s*#?\s*([0-9]{3,10})\b/i);
  // Padrão 4: "Código: 12345" ou "Cód: ABC-123"
  const matchIdCodigo = texto.match(/\b(?:C[ÓOó]DIGO|C[ÓOó]D)\s*[:#]\s*([0-9A-Za-z\-]{3,10})\b/i);
  // Padrão 5: Específico 99 Food isolado
  const match99 = texto.match(/\b99\s*(?:FOOD|ENTREGA)?\s*[:#\-]?\s*#?\s*([0-9]{3,8})\b/i);

  if (matchIdHash) {
    pedidoId = matchIdHash[1];
  } else if (matchCentered) {
    pedidoId = matchCentered[1];
  } else if (matchIdPedido) {
    pedidoId = matchIdPedido[1];
  } else if (match99) {
    pedidoId = match99[1];
    origem = '99FOOD';
  } else if (matchIdCodigo) {
    pedidoId = matchIdCodigo[1];
  }

  // Filtrar palavras comuns que não são números de pedido
  const idsInvalidos = [
    'RESET', 'PRESET', 'ESET', 'NULL', 'TRUE', 'FALSE', 'TEST', 'PAGE', 
    'PRINT', 'DATA', 'START', 'STOP', 'EPSON', 'ING', 'IGO', 'DIGO',
    'ODIGO', 'CODIGO', 'PEDIDO', 'ORDEM', 'ERROR', 'FONT', 'MODE',
    'PAPER', 'FEED', 'CUT', 'OPEN', 'CLOSE', 'INIT', 'CONFIG'
  ];
  if (pedidoId && (idsInvalidos.includes(pedidoId.toUpperCase()) || pedidoId.length < 3)) {
    pedidoId = null;
  }

  if (!pedidoId) {
    return null;
  }

  // 3. Extrair Cliente / Nome
  let cliente = null;

  if (origem === '99FOOD') {
    // No 99 Food, o nome do cliente vem logo após o número do pedido "#123456"
    for (let i = 0; i < linhas.length; i++) {
      if (linhas[i].includes(`#${pedidoId}`) || linhas[i].match(new RegExp(`#\\s*${pedidoId}\\b`))) {
        for (let j = i + 1; j < Math.min(i + 4, linhas.length); j++) {
          const cand = linhas[j].trim();
          if (cand.length >= 2 && 
              !cand.startsWith('-') && 
              !cand.startsWith('#') &&
              !cand.match(/^(?:Entrega|Previs|Telefone|Localizador|Endere)/i)) {
            cliente = cand;
            break;
          }
        }
        break;
      }
    }
  } else if (origem === 'IFOOD') {
    // No iFood Gestor, o nome fica entre "pedidos na sua loja" e "0800" / "Endereco:"
    for (let i = 0; i < linhas.length; i++) {
      if (linhas[i].match(/pedidos?\s+na\s+sua\s+loja/i)) {
        for (let j = i + 1; j < Math.min(i + 4, linhas.length); j++) {
          const cand = linhas[j].trim();
          if (cand.length >= 2 && 
              !cand.match(/^0800/) && 
              !cand.match(/^Endere/i) &&
              !cand.match(/^-+$/) &&
              !cand.match(/^\d+$/) &&
              !cand.match(/^ID:/i)) {
            cliente = cand;
            break;
          }
        }
        break;
      }
    }
    // Fallback: Linha anterior a "0800" ou "ID:"
    if (!cliente) {
      for (let i = 0; i < linhas.length; i++) {
        if (linhas[i].match(/^0800.*ID:/i) || linhas[i].match(/\bID:\s*\d/i)) {
          if (i > 0) {
            const cand = linhas[i - 1].trim();
            if (cand.length >= 2 && !cand.match(/^-+$/) && !cand.match(/pedidos?\s+na/i) && !cand.match(/Localizador/i)) {
              cliente = cand;
            }
          }
          break;
        }
      }
    }
  }

  // Fallback Geral para Cliente: Rótulo explícito (excluindo "Cobrar do cliente")
  if (!cliente) {
    const matchClienteLabel = texto.match(/(?<!\bCobrar\s+do\s+)\b(?:Cliente|Nome|Destinat[áa]rio|Entregar para)\s*:\s*([^\n\r]+)/i);
    if (matchClienteLabel) {
      const nomeCandidate = matchClienteLabel[1].trim();
      if (!nomeCandidate.match(/^R\$/) && nomeCandidate.length >= 2) {
        cliente = nomeCandidate;
      }
    }
  }

  // 4. Extração de Endereço Completo & Bairro
  let endereco = null;
  let bairro = null;
  let complemento = null;
  let cidade = 'Teresópolis - RJ';

  if (origem === '99FOOD') {
    // ── 99 FOOD: O endereço é um bloco multilinha após "Endereço:" até a divisória "---"
    const matchBloco99 = texto.match(/Endere[çc]o:\s*([\s\S]*?)(?=\n\s*-{5,}|\n\s*Observa|\n\s*Telefone|\n\s*O cliente|\n\s*$)/i);
    if (matchBloco99) {
      let linhasEnd = matchBloco99[1].split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
      let rawEnd = linhasEnd.join(' ');

      // Corrigir quebras de palavras feitas pela impressora térmica (ex: "Tere sópolis" -> "Teresópolis")
      rawEnd = rawEnd
        .replace(/Tere\s+s[oó]polis/gi, 'Teresópolis')
        .replace(/Barr\s+a\s+do\s+Imbu[íi]/gi, 'Barra do Imbuí')
        .replace(/farma\s+cia/gi, 'farmácia')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/\s*\.\s*/g, '.')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();

      endereco = rawEnd;

      // Tentar extrair Bairro conhecido ou padrão (usando boundary compatível com acentos)
      const matchBairro99 = endereco.match(/(?:^|[\s,])(V[aá]rzea|Barra\s+do\s+Imbu[íi]|Alto|Taumaturgo|S[aã]o\s+Pedro|Tijuca|Agri[õo]es|Meudon|Golfe|Ermitage|Comari|Cascata\s+dos\s+Amores|Quebra\s+Frascos|Fazendinha|Granja\s+Guarani|Araras|Posse|Bonsucesso)(?=$|[\s,.\-!?;:])/i);
      if (matchBairro99) {
        bairro = matchBairro99[1].trim();
      }

      // Garantir que a cidade Teresópolis esteja no endereço para o GPS
      if (!/Teres[oó]polis/i.test(endereco)) {
        endereco += ', Teresópolis - RJ';
      }
    }
  } else if (origem === 'IFOOD') {
    // ── IFOOD GESTOR: Campos estruturados linha a linha
    const matchEndLabel = texto.match(/Endere[çc]o:\s*([^\n\r]+)/i);
    const matchComp = texto.match(/\bComp(?:lemento)?:\s*([^\n\r]+)/i);
    const matchBairroIfood = texto.match(/\bBairro:\s*([^\n\r]+)/i);
    const matchRef = texto.match(/\bRef(?:er[êe]ncia)?:\s*([^\n\r]+)/i);
    const matchCidadeIfood = texto.match(/\bCidade:\s*([^\n\r]+)/i);

    const rua = matchEndLabel ? matchEndLabel[1].trim() : null;
    complemento = matchComp ? matchComp[1].trim() : null;
    bairro = matchBairroIfood ? matchBairroIfood[1].trim() : null;
    const ref = matchRef ? matchRef[1].trim() : null;
    const cidadeRaw = matchCidadeIfood ? matchCidadeIfood[1].trim() : null;

    if (rua) {
      let partes = [rua];
      if (complemento) partes.push(complemento);
      if (bairro) partes.push(bairro);
      if (ref) partes.push(`(Ref: ${ref})`);
      if (cidadeRaw) {
        partes.push(cidadeRaw);
      } else {
        partes.push('Teresópolis - RJ');
      }
      endereco = partes.join(', ');
    }
  }

  // Fallback Geral para Endereço
  if (!endereco) {
    const matchEndFallback = texto.match(/(?:Endere[çc]o|Entrega|Entregar em|Destino|Local de entrega):\s*([^\n\r]+)/i);
    if (matchEndFallback) {
      endereco = matchEndFallback[1].trim();
    } else {
      const matchRua = texto.match(/(?:Rua|Av\.|Avenida|Travessa|Alameda|Estrada|Praça)\s+[^\n\r,]+,\s*[0-9]+[^\n\r]*/i);
      if (matchRua) {
        endereco = matchRua[0].trim();
      }
    }
    if (endereco && !/Teres[oó]polis/i.test(endereco)) {
      endereco += ', Teresópolis - RJ';
    }
  }

  // Fallback Geral para Bairro
  if (!bairro) {
    const matchB = texto.match(/\b(?:Bairro|Regi[ãa]o):\s*([^\n\r]+)/i);
    if (matchB) {
      bairro = matchB[1].trim().split('\n')[0].split('-')[0].trim();
    }
  }

  // 5. Extrair Taxa de Entrega
  let taxaEntrega = 0.0;
  const matchTaxa = texto.match(/(?:Taxa\s*(?:de\s*)?entrega|Tx\s*entrega|Frete|Valor\s*(?:da\s*)?entrega)[\s.:_\-]*R\$\s*([0-9]+[.,][0-9]{2})/i);
  if (matchTaxa) {
    const taxaNum = parseFloat(matchTaxa[1].replace('.', '').replace(',', '.'));
    if (!isNaN(taxaNum)) {
      taxaEntrega = taxaNum;
    }
  }

  // 6. Extrair Telefone
  let telefone = null;
  const matchTel = texto.match(/(?:Tel(?:efone)?|Cel(?:ular)?|WhatsApp|Contato)\s*:\s*(\(?[0-9]{2,3}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4})/i);
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

/**
 * Decodificador de Comandos ESC/POS RAW (.SPL) para Texto Puro
 * Remove caracteres de controle binários, inicialização, cortes de papel e comandos gráficos.
 */

// Tabela de conversão de CP850 (Code Page comum na Epson TM-T20 no Brasil) para UTF-8
const CP850_MAP = {
  0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'à', 0x86: 'å', 0x87: 'ç',
  0x88: 'ê', 0x89: 'ë', 0x8A: 'è', 0x8B: 'ï', 0x8C: 'î', 0x8D: 'ì', 0x8E: 'Ä', 0x8F: 'Å',
  0x90: 'É', 0x91: 'æ', 0x92: 'Æ', 0x93: 'ô', 0x94: 'ö', 0x95: 'ò', 0x96: 'û', 0x97: 'ù',
  0x98: 'ÿ', 0x99: 'Ö', 0x9A: 'Ü', 0x9B: 'ø', 0x9C: '£', 0x9D: 'Ø', 0x9E: '×', 0x9F: 'ƒ',
  0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ñ', 0xA5: 'Ñ', 0xA6: 'ª', 0xA7: 'º',
  0xC6: 'ã', 0xC7: 'Ã', 0xE5: 'õ', 0xE4: 'Õ'
};

function decodeEscPosBuffer(buffer) {
  if (!buffer || buffer.length === 0) return '';

  let out = '';
  let i = 0;
  const len = buffer.length;

  while (i < len) {
    const byte = buffer[i];

    // Tratar ESC (0x1B)
    if (byte === 0x1B) {
      i++;
      if (i >= len) break;
      const cmd = buffer[i];

      // ESC @ (Initialize)
      if (cmd === 0x40) { i++; continue; }
      // ESC ! n, ESC a n, ESC d n, ESC J n, ESC M n, ESC E n, ESC G n, ESC t n
      if ([0x21, 0x61, 0x64, 0x4A, 0x4D, 0x45, 0x47, 0x74, 0x33].includes(cmd)) {
        i += 2; // Pula comando + parâmetro n
        continue;
      }
      i++;
      continue;
    }

    // Tratar GS (0x1D)
    if (byte === 0x1D) {
      i++;
      if (i >= len) break;
      const cmd = buffer[i];

      // GS V m [n] (Cut paper)
      if (cmd === 0x56) {
        i++;
        if (i < len && (buffer[i] === 0x41 || buffer[i] === 0x42 || buffer[i] === 0x61 || buffer[i] === 0x62)) {
          i += 2;
        } else {
          i++;
        }
        continue;
      }

      // GS ! n, GS B n, GS f n, GS H n, GS w n, GS h n
      if ([0x21, 0x42, 0x66, 0x48, 0x77, 0x68].includes(cmd)) {
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // Tratar FS (0x1C)
    if (byte === 0x1C) {
      i += 2;
      continue;
    }

    // Quebras de linha e tabs padrão
    if (byte === 0x0A || byte === 0x0D) {
      out += '\n';
      i++;
      continue;
    }
    if (byte === 0x09) {
      out += ' ';
      i++;
      continue;
    }

    // Caracteres imprimíveis padrão ASCII (0x20 a 0x7E)
    if (byte >= 0x20 && byte <= 0x7E) {
      out += String.fromCharCode(byte);
      i++;
      continue;
    }

    // Caracteres acentuados CP850
    if (CP850_MAP[byte]) {
      out += CP850_MAP[byte];
      i++;
      continue;
    }

    // Latin1 fallback para acentos
    if (byte >= 0xC0 && byte <= 0xFF) {
      out += Buffer.from([byte]).toString('latin1');
      i++;
      continue;
    }

    // Ignorar bytes de controle nulos ou irrelevantes
    i++;
  }

  // Normalizar quebras de linha repetidas e espaços excessivos
  return out
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { decodeEscPosBuffer };

import type { PrintParser } from '../../core';
import type { PrintElement } from '../../builder';

/** One decoded Star Line Mode command: its mnemonic name and raw bytes. */
export interface StarPrntParsedCommand {
  name: string;
  bytes: number[];
}

/** Full result of parsing a Star Line Mode byte stream. */
export interface StarPrntParseResult {
  commands: StarPrntParsedCommand[];
  elements: PrintElement[];
  warnings: string[];
}

/**
 * Decodes a Star Line Mode byte stream into commands plus recovered
 * `PrintElement`s. Exported alongside the class wrapper below so byte-in
 * callers — `ConversionRegistry`'s starprnt source entry, for one — can reach
 * it as a plain function, the same shape every other language's parser offers.
 */
export function decodeStarPrnt(data: Uint8Array): StarPrntParseResult {
  const commands: StarPrntParsedCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let i = 0;
  let currentAlign: 'left' | 'center' | 'right' = 'left';
  let isBold = false;

  while (i < data.length) {
    const b = data[i]!;

    if (b === 0x1b && i + 1 < data.length) {
      const cmd = data[i + 1]!;

      if (cmd === 0x40) {
        commands.push({ name: 'ESC @', bytes: [0x1b, 0x40] });
        isBold = false;
        currentAlign = 'left';
        i += 2;
        continue;
      }

      // Text alignment selector, 4 bytes total: ESC, GS, 'a', n
      if (cmd === 0x1d && i + 3 < data.length && data[i + 2] === 0x61) {
        const n = data[i + 3]!;
        currentAlign = n === 1 ? 'center' : n === 2 ? 'right' : 'left';
        commands.push({ name: 'ESC GS a', bytes: [0x1b, 0x1d, 0x61, n] });
        i += 4;
        continue;
      }

      if (cmd === 0x45) {
        isBold = true;
        commands.push({ name: 'ESC E', bytes: [0x1b, 0x45] });
        i += 2;
        continue;
      }

      if (cmd === 0x46) {
        isBold = false;
        commands.push({ name: 'ESC F', bytes: [0x1b, 0x46] });
        i += 2;
        continue;
      }

      if (cmd === 0x2d && i + 2 < data.length) {
        commands.push({ name: 'ESC -', bytes: [0x1b, 0x2d, data[i + 2]!] });
        i += 3;
        continue;
      }

      if (cmd === 0x69 && i + 3 < data.length) {
        commands.push({ name: 'ESC i', bytes: [0x1b, 0x69, data[i + 2]!, data[i + 3]!] });
        i += 4;
        continue;
      }

      if (cmd === 0x64 && i + 2 < data.length) {
        commands.push({ name: 'ESC d', bytes: [0x1b, 0x64, data[i + 2]!] });
        i += 3;
        continue;
      }

      // ESC * r A — enter raster mode; consume raster line records until ESC * r B.
      if (cmd === 0x2a && i + 3 < data.length && data[i + 2] === 0x72 && data[i + 3] === 0x41) {
        commands.push({ name: 'ESC * r A', bytes: [0x1b, 0x2a, 0x72, 0x41] });
        i += 4;

        while (i < data.length) {
          if (data[i] === 0x1b && i + 3 < data.length && data[i + 1] === 0x2a && data[i + 2] === 0x72 && data[i + 3] === 0x42) {
            commands.push({ name: 'ESC * r B', bytes: [0x1b, 0x2a, 0x72, 0x42] });
            i += 4;
            break;
          }
          if (data[i] === 0x62 && i + 2 < data.length) {
            const nL = data[i + 1]!;
            const nH = data[i + 2]!;
            const len = nL + nH * 256;
            commands.push({ name: 'b', bytes: [0x62, nL, nH] });
            i += 3 + len;
          } else {
            i++;
          }
        }
        continue;
      }

      commands.push({ name: `ESC ${String.fromCharCode(cmd)}`, bytes: [0x1b, cmd] });
      i += 2;
      continue;
    }

    if (b === 0x07) {
      commands.push({ name: 'BEL', bytes: [0x07] });
      i++;
      continue;
    }

    if (b === 0x0a) {
      commands.push({ name: 'LF', bytes: [0x0a] });
      i++;
      continue;
    }

    if (b >= 0x20 && b <= 0x7e) {
      let text = '';
      while (i < data.length && data[i]! >= 0x20 && data[i]! <= 0x7e) {
        text += String.fromCharCode(data[i]!);
        i++;
      }
      commands.push({ name: 'TEXT', bytes: Array.from(new TextEncoder().encode(text)) });
      elements.push({
        type: 'text',
        content: text,
        options: { align: currentAlign, bold: isBold || undefined },
      });
      continue;
    }

    i++;
  }

  return { commands, elements, warnings };
}

/** Decodes a Star Line Mode byte stream into structured commands. Direct port of portakal's `parseStarPRNT()`. */
export class StarPrntParser implements PrintParser<StarPrntParseResult> {
  parse(source: string | Uint8Array): StarPrntParseResult {
    const bytes = typeof source === 'string' ? new TextEncoder().encode(source) : source;
    return decodeStarPrnt(bytes);
  }
}

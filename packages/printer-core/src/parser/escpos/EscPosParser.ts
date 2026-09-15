import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document';

/** One decoded ESC/POS command: its mnemonic name, raw bytes, and decoded parameters. */
export interface EscPosParsedCommand {
  name: string;
  bytes: number[];
  params: Record<string, unknown>;
}

/** Full result of parsing an ESC/POS byte stream. */
export interface EscPosParseResult {
  commands: EscPosParsedCommand[];
  elements: PrintElement[];
  warnings: string[];
}

function decodeEscPos(data: Uint8Array): EscPosParseResult {
  const commands: EscPosParsedCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let i = 0;
  let currentAlign: 'left' | 'center' | 'right' = 'left';
  let isBold = false;
  let isUnderline = false;
  let sizeW = 1;
  let sizeH = 1;

  while (i < data.length) {
    const b = data[i]!;

    if (b === 0x1b && i + 1 < data.length) {
      const cmd = data[i + 1]!;

      switch (cmd) {
        case 0x40:
          commands.push({ name: 'ESC @', bytes: [0x1b, 0x40], params: {} });
          currentAlign = 'left';
          isBold = false;
          isUnderline = false;
          sizeW = sizeH = 1;
          i += 2;
          continue;

        case 0x61:
          if (i + 2 < data.length) {
            const n = data[i + 2]!;
            currentAlign = n === 1 ? 'center' : n === 2 ? 'right' : 'left';
            commands.push({ name: 'ESC a', bytes: [0x1b, 0x61, n], params: { align: currentAlign } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x45:
          if (i + 2 < data.length) {
            isBold = data[i + 2] !== 0;
            commands.push({ name: 'ESC E', bytes: [0x1b, 0x45, data[i + 2]!], params: { bold: isBold } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x2d:
          if (i + 2 < data.length) {
            isUnderline = data[i + 2] !== 0;
            commands.push({ name: 'ESC -', bytes: [0x1b, 0x2d, data[i + 2]!], params: { underline: isUnderline } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x4d:
          if (i + 2 < data.length) {
            commands.push({ name: 'ESC M', bytes: [0x1b, 0x4d, data[i + 2]!], params: { font: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x21:
          if (i + 2 < data.length) {
            const n = data[i + 2]!;
            commands.push({ name: 'ESC !', bytes: [0x1b, 0x21, n], params: { mode: n } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x56:
          if (i + 2 < data.length) {
            commands.push({ name: 'ESC V', bytes: [0x1b, 0x56, data[i + 2]!], params: { rotation: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x7b:
          if (i + 2 < data.length) {
            commands.push({
              name: 'ESC {',
              bytes: [0x1b, 0x7b, data[i + 2]!],
              params: { upsideDown: data[i + 2] !== 0 },
            });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x64:
          if (i + 2 < data.length) {
            commands.push({ name: 'ESC d', bytes: [0x1b, 0x64, data[i + 2]!], params: { lines: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x4a:
          if (i + 2 < data.length) {
            commands.push({ name: 'ESC J', bytes: [0x1b, 0x4a, data[i + 2]!], params: { dots: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x33:
          if (i + 2 < data.length) {
            commands.push({ name: 'ESC 3', bytes: [0x1b, 0x33, data[i + 2]!], params: { spacing: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x32:
          commands.push({ name: 'ESC 2', bytes: [0x1b, 0x32], params: {} });
          i += 2;
          continue;

        case 0x74:
          if (i + 2 < data.length) {
            commands.push({ name: 'ESC t', bytes: [0x1b, 0x74, data[i + 2]!], params: { codePage: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x70:
          if (i + 4 < data.length) {
            commands.push({
              name: 'ESC p',
              bytes: [0x1b, 0x70, data[i + 2]!, data[i + 3]!, data[i + 4]!],
              params: { pin: data[i + 2], onTime: data[i + 3], offTime: data[i + 4] },
            });
            i += 5;
          } else {
            i += 2;
          }
          continue;

        default:
          commands.push({ name: `ESC ${String.fromCharCode(cmd)}`, bytes: [0x1b, cmd], params: {} });
          i += 2;
          continue;
      }
    }

    if (b === 0x1d && i + 1 < data.length) {
      const cmd = data[i + 1]!;

      switch (cmd) {
        case 0x21:
          if (i + 2 < data.length) {
            const n = data[i + 2]!;
            // eslint-disable-next-line no-bitwise -- unpacking GS ! n's width/height nibbles, per spec
            sizeW = ((n >> 4) & 0x07) + 1;
            // eslint-disable-next-line no-bitwise -- see above
            sizeH = (n & 0x07) + 1;
            commands.push({ name: 'GS !', bytes: [0x1d, 0x21, n], params: { width: sizeW, height: sizeH } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x42:
          if (i + 2 < data.length) {
            commands.push({ name: 'GS B', bytes: [0x1d, 0x42, data[i + 2]!], params: { reverse: data[i + 2] !== 0 } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x48:
          if (i + 2 < data.length) {
            commands.push({ name: 'GS H', bytes: [0x1d, 0x48, data[i + 2]!], params: { position: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x68:
          if (i + 2 < data.length) {
            commands.push({ name: 'GS h', bytes: [0x1d, 0x68, data[i + 2]!], params: { height: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x77:
          if (i + 2 < data.length) {
            commands.push({ name: 'GS w', bytes: [0x1d, 0x77, data[i + 2]!], params: { width: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x66:
          if (i + 2 < data.length) {
            commands.push({ name: 'GS f', bytes: [0x1d, 0x66, data[i + 2]!], params: { font: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x6b:
          if (i + 2 < data.length) {
            const m = data[i + 2]!;
            if (m >= 65) {
              if (i + 3 < data.length) {
                const n = data[i + 3]!;
                const barcodeData = data.slice(i + 4, i + 4 + n);
                commands.push({
                  name: 'GS k',
                  bytes: Array.from(data.slice(i, i + 4 + n)),
                  params: { type: m, length: n, data: new TextDecoder().decode(barcodeData) },
                });
                i += 4 + n;
              } else {
                i += 3;
              }
            } else {
              const start = i + 3;
              let end = start;
              while (end < data.length && data[end] !== 0) end++;
              commands.push({
                name: 'GS k',
                bytes: Array.from(data.slice(i, end + 1)),
                params: { type: m, data: new TextDecoder().decode(data.slice(start, end)) },
              });
              i = end + 1;
            }
          } else {
            i += 2;
          }
          continue;

        case 0x56:
          if (i + 2 < data.length) {
            const m = data[i + 2]!;
            if (m === 65 || m === 66) {
              if (i + 3 < data.length) {
                commands.push({ name: 'GS V', bytes: [0x1d, 0x56, m, data[i + 3]!], params: { mode: m, feed: data[i + 3] } });
                i += 4;
              } else {
                i += 3;
              }
            } else {
              commands.push({ name: 'GS V', bytes: [0x1d, 0x56, m], params: { mode: m } });
              i += 3;
            }
          } else {
            i += 2;
          }
          continue;

        case 0x76:
          if (i + 7 < data.length && data[i + 2] === 0x30) {
            const m = data[i + 3]!;
            const xL = data[i + 4]!;
            const xH = data[i + 5]!;
            const yL = data[i + 6]!;
            const yH = data[i + 7]!;
            const bytesPerRow = xL + xH * 256;
            const rows = yL + yH * 256;
            const dataLen = bytesPerRow * rows;
            commands.push({
              name: 'GS v 0',
              bytes: Array.from(data.slice(i, i + 8)),
              params: { mode: m, bytesPerRow, rows, dataLength: dataLen },
            });
            i += 8 + dataLen;
          } else {
            i += 2;
          }
          continue;

        case 0x28:
          if (i + 2 < data.length) {
            const fn = data[i + 2]!;
            if (fn === 0x6b && i + 4 < data.length) {
              const pL = data[i + 3]!;
              const pH = data[i + 4]!;
              const len = pL + pH * 256;
              commands.push({
                name: 'GS ( k',
                bytes: Array.from(data.slice(i, i + 5 + len)),
                params: { function: fn, length: len },
              });
              i += 5 + len;
            } else {
              commands.push({ name: `GS ( ${String.fromCharCode(fn)}`, bytes: [0x1d, 0x28, fn], params: {} });
              i += 3;
            }
          } else {
            i += 2;
          }
          continue;

        case 0x61:
          if (i + 2 < data.length) {
            commands.push({ name: 'GS a', bytes: [0x1d, 0x61, data[i + 2]!], params: { enable: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        case 0x72:
          if (i + 2 < data.length) {
            commands.push({ name: 'GS r', bytes: [0x1d, 0x72, data[i + 2]!], params: { type: data[i + 2] } });
            i += 3;
          } else {
            i += 2;
          }
          continue;

        default:
          commands.push({ name: `GS ${String.fromCharCode(cmd)}`, bytes: [0x1d, cmd], params: {} });
          i += 2;
          continue;
      }
    }

    if (b === 0x10 && i + 1 < data.length) {
      const cmd = data[i + 1]!;
      if (cmd === 0x04 && i + 2 < data.length) {
        commands.push({ name: 'DLE EOT', bytes: [0x10, 0x04, data[i + 2]!], params: { type: data[i + 2] } });
        i += 3;
        continue;
      }
      if (cmd === 0x05 && i + 2 < data.length) {
        commands.push({ name: 'DLE ENQ', bytes: [0x10, 0x05, data[i + 2]!], params: { type: data[i + 2] } });
        i += 3;
        continue;
      }
      if (cmd === 0x14 && i + 4 < data.length) {
        commands.push({
          name: 'DLE DC4',
          bytes: [0x10, 0x14, data[i + 2]!, data[i + 3]!, data[i + 4]!],
          params: { fn: data[i + 2], m: data[i + 3], t: data[i + 4] },
        });
        i += 5;
        continue;
      }
      i += 2;
      continue;
    }

    if (b === 0x1c && i + 1 < data.length) {
      const cmd = data[i + 1]!;
      commands.push({ name: `FS ${String.fromCharCode(cmd)}`, bytes: [0x1c, cmd], params: {} });
      i += 2;
      continue;
    }

    if (b === 0x0a) {
      commands.push({ name: 'LF', bytes: [0x0a], params: {} });
      i++;
      continue;
    }

    if (b >= 0x20 && b <= 0x7e) {
      let text = '';
      while (i < data.length && data[i]! >= 0x20 && data[i]! <= 0x7e) {
        text += String.fromCharCode(data[i]!);
        i++;
      }
      commands.push({ name: 'TEXT', bytes: Array.from(new TextEncoder().encode(text)), params: { text } });
      elements.push({
        type: 'text',
        content: text,
        options: {
          align: currentAlign,
          bold: isBold || undefined,
          underline: isUnderline || undefined,
          size: Math.max(sizeW, sizeH),
        },
      });
      continue;
    }

    i++;
  }

  return { commands, elements, warnings };
}

/** Decodes an ESC/POS byte stream into structured commands (binary state machine over ESC/GS/DLE/FS prefixes). */
export class EscPosParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(bytes: Uint8Array): { commands: unknown[]; warnings: string[] } {
    return decodeEscPos(bytes);
  }
}

import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';

export interface SBPLCommand {
  cmd: string;
  params: string;
}

export interface SBPLParseResult {
  commands: SBPLCommand[];
  elements: PrintElement[];
  warnings: string[];
}

const ESC = '\x1b';

/** Số chữ số của trường số theo sau các lệnh `H`/`V`/`L`, theo SBPL Programming Reference. */
const COMMAND_FIELD_DIGITS = 4;
/** Độ dài tiền tố font trong lệnh text `K9B` (chính là `'9B'.length`). */
const TEXT_FIELD_PREFIX_LENGTH = 2;

interface ParsedTextField {
  command: SBPLCommand;
  element: PrintElement;
}

/**
 * `<ESC>K9B` — trường text (font `9B`, ASCII/Kanji hỗn hợp) là trường duy
 * nhất trong SBPL có payload giải mã được thành `PrintElement`; `x`/`y` được
 * truyền vào từ vị trí `H`/`V` gần nhất mà `parseSBPL()` đang theo dõi.
 */
function parseTextField(rest: string, x: number, y: number): ParsedTextField {
  const text = rest.slice(TEXT_FIELD_PREFIX_LENGTH).split(ESC)[0] ?? '';
  return {
    command: { cmd: 'TEXT', params: text },
    element: { type: 'text', content: text, options: { x, y } },
  };
}

/**
 * Grammar của SBPL không có cấu trúc dòng để tách (khác CPCL/EPL2 phân tách
 * bằng newline) — mọi trường đều có tiền tố `<ESC>` nối liền nhau, nên parser
 * này tách theo chính ký tự điều khiển `ESC` rồi switch theo chữ cái đầu của
 * mỗi đoạn. Chỉ `H`/`V` (theo dõi vị trí hiện tại) và `K9B` (trường text)
 * được dựng thành `elements`; các trường nhận diện được khác vẫn ghi vào
 * `commands` nhưng không có `PrintElement` tương ứng.
 */
export function parseSBPL(code: string): SBPLParseResult {
  const commands: SBPLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let currentX = 0;
  let currentY = 0;

  const parts = code.split(ESC);

  for (const part of parts) {
    if (!part) continue;

    const cmdChar = part[0];
    const rest = part.slice(1);

    switch (cmdChar) {
      case 'A':
        commands.push({ cmd: 'START', params: rest });
        break;

      case 'Z':
        commands.push({ cmd: 'END', params: rest });
        break;

      case 'C':
        if (rest.startsWith('S')) {
          commands.push({ cmd: 'CLEAR', params: rest });
        }
        break;

      case 'H':
        currentX = Number(rest.slice(0, COMMAND_FIELD_DIGITS)) || 0;
        commands.push({ cmd: 'H', params: rest.slice(0, COMMAND_FIELD_DIGITS) });
        break;

      case 'V':
        currentY = Number(rest.slice(0, COMMAND_FIELD_DIGITS)) || 0;
        commands.push({ cmd: 'V', params: rest.slice(0, COMMAND_FIELD_DIGITS) });
        break;

      case 'L':
        commands.push({ cmd: 'L', params: rest.slice(0, COMMAND_FIELD_DIGITS) });
        break;

      case '%':
        commands.push({ cmd: 'ROTATION', params: rest[0] ?? '0' });
        break;

      case 'K':
        // Chỉ biến thể font `9B` (ASCII/Kanji hỗn hợp) mang payload text giải mã được.
        if (rest.startsWith('9B')) {
          const { command, element } = parseTextField(rest, currentX, currentY);
          commands.push(command);
          elements.push(element);
        } else {
          commands.push({ cmd: 'K', params: rest });
        }
        break;

      case 'B':
      case 'D':
        commands.push({ cmd: `BARCODE_${cmdChar}`, params: rest });
        break;

      case 'G':
        // `GM` là sub-command đồ hoạ duy nhất mà ngôn ngữ này định nghĩa.
        if (rest.startsWith('M')) {
          commands.push({ cmd: 'GRAPHIC', params: rest });
        }
        break;

      case 'F':
        // `FW` là sub-command vẽ duy nhất dưới tiền tố `F`.
        if (rest.startsWith('W')) {
          commands.push({ cmd: 'DRAW', params: rest.slice(1) });
        }
        break;

      case 'Q':
        commands.push({ cmd: 'QUANTITY', params: rest });
        break;

      case '2':
        // Trường barcode 2D được nhận diện qua chữ số đầu thay vì chữ cái.
        if (rest.startsWith('D')) {
          commands.push({ cmd: '2D_BARCODE', params: rest });
        }
        break;

      default:
        commands.push({ cmd: cmdChar, params: rest });
        break;
    }
  }

  return { commands, elements, warnings };
}

/**
 * Giải mã mã nguồn SBPL thành các lệnh có cấu trúc (phân tách bằng `<ESC>`,
 * đóng khung bởi `<ESC>A`/`<ESC>Z`).
 */
export class SbplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseSBPL(code);
  }
}

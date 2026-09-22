import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';

/**
 * Một lệnh CPCL đã decode: động từ lệnh và các token whitespace-split theo
 * sau trên cùng dòng. Ngữ pháp CPCL phân cách bằng khoảng trắng trong dòng,
 * khác EPL2 phân cách bằng dấu phẩy — nên shape này khác `{cmd, raw}` của
 * `EplParser`.
 */
export interface CPCLCommand {
  cmd: string;
  params: string[];
}

export interface CPCLParseResult {
  commands: CPCLCommand[];
  widthDots: number;
  heightDots: number;
  dpi: number;
  elements: PrintElement[];
  warnings: string[];
}

const DEFAULT_WIDTH_DOTS = 576;
const DEFAULT_HEIGHT_DOTS = 400;
const DEFAULT_DPI = 203;

const DEFAULT_TEXT_FONT = '2';

/**
 * Số tham số tối thiểu của header session (`! <offset> <hDPI> <vDPI>
 * <height> <copies>`) cần có để đọc được dpi/height.
 */
const SESSION_HEADER_MIN_PARTS = 4;

/**
 * Header session CPCL: `! <offset> <hDPI> <vDPI> <height> <copies>`. Trả về
 * object rỗng khi dòng chưa đủ tham số, để nơi gọi giữ nguyên `dpi`/
 * `heightDots` hiện tại.
 */
function parseSessionHeader(parts: string[]): { dpi?: number; heightDots?: number } {
  if (parts.length < SESSION_HEADER_MIN_PARTS) return {};
  return {
    dpi: Number(parts[1]) || undefined,
    heightDots: Number(parts[3]) || undefined,
  };
}

/**
 * TEXT/TEXT90/TEXT180/TEXT270 (và alias T/VTEXT) dùng chung shape tham số
 * `<font> <size> <x> <y>` — chuỗi cần in nằm trên dòng theo sau, không inline.
 */
function parseTextElement(parts: string[], content: string): PrintElement {
  const font = parts[1] ?? DEFAULT_TEXT_FONT;
  // Giữ nguyên size parse được, kể cả 0 — không áp sàn `|| 1`, nhất quán với EplParser.
  const size = Number(parts[2] ?? 0);
  const x = Number(parts[3] ?? 0);
  const y = Number(parts[4] ?? 0);
  return {
    type: 'text',
    content,
    options: { x, y, font, size },
  };
}

function parseBoxElement(parts: string[]): PrintElement {
  const x1 = Number(parts[1] ?? 0);
  const y1 = Number(parts[2] ?? 0);
  const x2 = Number(parts[3] ?? 0);
  const y2 = Number(parts[4] ?? 0);
  const thickness = Number(parts[5] ?? 1);
  return {
    type: 'box',
    options: { x: x1, y: y1, width: x2 - x1, height: y2 - y1, thickness },
  };
}

function parseLineElement(parts: string[]): PrintElement {
  const x1 = Number(parts[1] ?? 0);
  const y1 = Number(parts[2] ?? 0);
  const x2 = Number(parts[3] ?? 0);
  const y2 = Number(parts[4] ?? 0);
  const thickness = Number(parts[5] ?? 1);
  return {
    type: 'line',
    options: { x1, y1, x2, y2, thickness },
  };
}

/**
 * Parse nguồn CPCL thành các lệnh có cấu trúc kèm `PrintElement` để preview.
 * Có tính session: dòng header `!` khởi tạo `dpi`/`heightDots`, và field text
 * tiêu thụ thêm một dòng dữ liệu thô theo sau thay vì mang inline.
 */
export function parseCPCL(code: string): CPCLParseResult {
  const commands: CPCLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let heightDots = DEFAULT_HEIGHT_DOTS;
  let dpi = DEFAULT_DPI;

  const lines = code.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    i++;
    if (!line) continue;

    // `!` mở đầu header session; loại trừ `!U` (động từ cấu hình máy in riêng biệt, cùng tiền tố `!`).
    if (line.startsWith('!') && !line.startsWith('!U')) {
      const headerParts = line.slice(1).trim().split(/\s+/);
      const header = parseSessionHeader(headerParts);
      if (header.dpi !== undefined) dpi = header.dpi;
      if (header.heightDots !== undefined) heightDots = header.heightDots;
      commands.push({ cmd: '!', params: headerParts });
      continue;
    }

    const parts = line.split(/\s+/);
    const cmd = parts[0].toUpperCase();
    commands.push({ cmd, params: parts.slice(1) });

    if (cmd.startsWith('TEXT') || cmd === 'T' || cmd === 'VTEXT') {
      // Tiêu thụ dòng theo sau làm nội dung chữ; hết dòng thì bỏ qua, không dựng element.
      if (i >= lines.length) continue;
      const content = lines[i].trim();
      i++;
      elements.push(parseTextElement(parts, content));
      continue;
    }

    if (cmd === 'BOX') {
      elements.push(parseBoxElement(parts));
      continue;
    }

    if (cmd === 'LINE') {
      elements.push(parseLineElement(parts));
      continue;
    }

    if (cmd === 'PAGE-WIDTH') {
      widthDots = Number(parts[1]) || widthDots;
      continue;
    }

    // BARCODE/EG/CG/PRINT/CENTER/LEFT/RIGHT/... đã ghi vào `commands` ở trên nhưng cố ý
    // không dựng thành element — giới hạn có chủ đích, không phải thiếu sót.
  }

  return { commands, widthDots, heightDots, dpi, elements, warnings };
}

/**
 * Decode nguồn CPCL thành các lệnh có cấu trúc (theo dòng, phân đoạn session
 * bằng `!` và `PRINT`).
 */
export class CpclParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseCPCL(code);
  }
}

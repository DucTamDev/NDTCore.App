import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';

/**
 * Một lệnh CPCL đã decode: động từ lệnh và các token whitespace-split theo
 * sau trên cùng dòng — khớp shape `{cmd, params}` mà `parsers/cpcl.ts` của
 * portakal dùng, giữ nguyên thay vì gộp vào shape `{cmd, raw}` của
 * `EplParser` — mỗi parser ngôn ngữ trong package này tự sở hữu shape lệnh
 * riêng (ngữ pháp CPCL phân cách bằng khoảng trắng trong một dòng, khác với
 * phần còn lại phân cách bằng dấu phẩy của EPL2 trong `raw`).
 */
export interface CPCLCommand {
  cmd: string;
  params: string[];
}

/** Kết quả đầy đủ của việc parse một chuỗi nguồn CPCL. */
export interface CPCLParseResult {
  commands: CPCLCommand[];
  widthDots: number;
  heightDots: number;
  dpi: number;
  elements: PrintElement[];
  warnings: string[];
}

const DEFAULT_WIDTH_DOTS = 576; // khớp giá trị fallback của parser CPCL gốc trong portakal
const DEFAULT_HEIGHT_DOTS = 400; // khớp giá trị fallback của parser CPCL gốc trong portakal
const DEFAULT_DPI = 203; // khớp giá trị fallback của parser CPCL gốc trong portakal

/** Font mặc định khi một lệnh TEXT không khai báo tham số font. */
const DEFAULT_TEXT_FONT = '2';

/**
 * Số tham số tối thiểu của dòng header session
 * (`! <offset> <hDPI> <vDPI> <height> <copies>`) để có thể đọc dpi/height.
 */
const SESSION_HEADER_MIN_PARTS = 4;

/**
 * Parse phần header session CPCL (`! <offset> <hDPI> <vDPI> <height>
 * <copies>`) thành các trường có thể cập nhật — trả về object rỗng khi dòng
 * chưa đủ tham số, để nơi gọi giữ nguyên giá trị `dpi`/`heightDots` hiện tại,
 * đúng hành vi gốc của portakal.
 */
function parseSessionHeader(parts: string[]): { dpi?: number; heightDots?: number } {
  if (parts.length < SESSION_HEADER_MIN_PARTS) return {};
  return {
    dpi: Number(parts[1]) || undefined,
    heightDots: Number(parts[3]) || undefined,
  };
}

/**
 * TEXT/TEXT90/TEXT180/TEXT270 (cùng các alias T/VTEXT) dùng chung shape tham
 * số: `<font> <size> <x> <y>`, còn chuỗi cần in nằm trên dòng theo sau chứ
 * không inline.
 */
function parseTextElement(parts: string[], content: string): PrintElement {
  const font = parts[1] ?? DEFAULT_TEXT_FONT;
  // Giữ nguyên giá trị size đã parse, không áp sàn `|| 1` khi parse ra `0` —
  // portakal ép size 0 lên 1 ở đây, nhưng parser EPL anh em trong package
  // này giữ nguyên giá trị size gốc không ép, và quy ước đó được áp dụng ở
  // đây luôn cho nhất quán.
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
 * Parse nguồn CPCL thành các lệnh có cấu trúc kèm `PrintElement` để preview
 * — port trực tiếp từ `parseCPCL()` (`parsers/cpcl.ts`) của portakal, giữ
 * nguyên phạm vi lệnh được hỗ trợ: `!`/`TEXT*`/`BOX`/`LINE`/`PAGE-WIDTH`
 * được decode thành element hoặc kích thước nhãn, mọi động từ CPCL đã nhận
 * diện khác (`BARCODE`, `EG`, `CG`, `PRINT`, `CENTER`, `LEFT`, `RIGHT`, ...)
 * vẫn được ghi vào `commands` nhưng cố ý không dựng thành element — đây là
 * giới hạn vốn có của portakal, đã ghi chú trong chính parser gốc của nó,
 * không phải lỗi port. Có tính chất session giống protocol thật: dòng header
 * `!` khởi tạo `dpi`/`heightDots`, và các field text CPCL tiêu thụ thêm một
 * dòng dữ liệu thô theo sau thay vì mang inline.
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

    // `!` mở đầu header session (`! <offset> <hDPI> <vDPI> <height> <copies>`)
    // — loại trừ `!U` (một động từ cấu hình máy in riêng biệt dùng chung tiền tố `!`).
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
      // Tiêu thụ dòng theo sau làm nội dung chữ của field này; nếu không
      // còn dòng nào, không có gì để dựng nên bỏ qua, giữ nguyên hành vi
      // gốc của portakal.
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

    // Mọi động từ đã nhận diện khác (BARCODE, EG, CG, PRINT, CENTER, LEFT,
    // RIGHT, ...) đã được ghi vào `commands` ở trên và chỉ đơn giản rơi
    // xuống đây mà không dựng thành element.
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

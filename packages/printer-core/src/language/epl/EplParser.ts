import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { Rotation } from '../../types';

/**
 * Một lệnh EPL2 đã giải mã: ký tự lệnh một chữ cái và phần văn bản thô đi
 * theo sau nó trên cùng dòng (đã trim). Các lệnh EPL2 phân tách nhau bằng dấu
 * xuống dòng thay vì một ký tự tiền tố đặc biệt (khác với ngữ pháp
 * `^`/`~`-prefixed của ZPL), nên không cần bộ tokenizer đa ký tự ở đây — chỉ
 * cần tách theo từng dòng; khớp với dạng `{cmd, raw}` của `parsers/epl.ts`
 * bên portakal.
 */
export interface EPLCommand {
  cmd: string;
  raw: string;
}

/** Kết quả đầy đủ của việc parse một chuỗi nguồn EPL2. */
export interface EPLParseResult {
  commands: EPLCommand[];
  widthDots: number;
  heightDots: number;
  elements: PrintElement[];
  warnings: string[];
}

// Khớp với giá trị fallback trong EPL parser gốc của portakal.
const DEFAULT_WIDTH_DOTS = 832;

/**
 * Mã xoay EPL2 (`0`-`3` — trường xoay riêng của lệnh `A`) chuyển ngược lại
 * thành `Rotation`, là chiều nghịch đảo của `eplRotation()` trong
 * `EplCompiler`.
 */
function eplRotationFromCode(code: number): Rotation {
  switch (code) {
    case 1:
      return 90;
    case 2:
      return 180;
    case 3:
      return 270;
    default:
      return 0;
  }
}

/**
 * Parse lệnh `A` (trường văn bản) của EPL2 thành `PrintElement` dạng text.
 * Ngữ pháp: `<x>,<y>,<mã xoay 0-3>,<font>,<hệ số ngang>,<hệ số dọc>,<N|R>,"<dữ liệu>"`.
 */
function parseTextCommand(line: string): PrintElement | undefined {
  const match = line.match(/^A(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),([NR]),"([^"]*)"/);
  if (!match) return undefined;

  return {
    type: 'text',
    content: match[8],
    options: {
      x: Number(match[1]),
      y: Number(match[2]),
      rotation: eplRotationFromCode(Number(match[3])),
      font: match[4],
      size: Number(match[5]),
      reverse: match[7] === 'R' || undefined,
    },
  };
}

/**
 * Parse lệnh `X` (trường box) của EPL2 thành `PrintElement` dạng box.
 * Ngữ pháp: `<x1>,<y1>,<x2>,<y2>,<độ dày>`.
 */
function parseBoxCommand(rest: string): PrintElement | undefined {
  const parts = rest.split(',').map(Number);
  if (parts.length < 5) return undefined;

  return {
    type: 'box',
    options: {
      x: parts[0],
      y: parts[1],
      width: parts[2] - parts[0],
      height: parts[3] - parts[1],
      thickness: parts[4],
    },
  };
}

/**
 * Parse lệnh `LO` (thanh đặc) của EPL2 thành `PrintElement` dạng line.
 * Ngữ pháp: `<x>,<y>,<width>,<height>`.
 */
function parseLineCommand(rest: string): PrintElement | undefined {
  if (!rest.startsWith('O')) return undefined;

  const parts = rest.slice(1).split(',').map(Number);
  if (parts.length < 4) return undefined;

  return {
    type: 'line',
    options: {
      x1: parts[0],
      y1: parts[1],
      x2: parts[0] + parts[2],
      y2: parts[1] + (parts[3] > parts[2] ? parts[3] : 0),
      thickness: Math.min(parts[2], parts[3]),
    },
  };
}

/**
 * Parse nguồn EPL2 thành các lệnh có cấu trúc cộng với `PrintElement` dùng để
 * xem trước — chuyển thể trực tiếp từ `parseEPL()` của portakal
 * (`parsers/epl.ts`), giữ đúng phạm vi ký tự lệnh: mỗi lệnh một chữ cái được
 * nhận diện đều hoặc được giải mã thành phần tử, hoặc được đọc-rồi-bỏ có chủ
 * đích (cùng các nhánh switch, cùng cách gom nhóm). Một ký tự lệnh không nhận
 * diện được sẽ bị bỏ qua âm thầm, khớp đúng parser gốc của portakal (nó không
 * có nhánh `default` đẩy warning, khác với `ZplParser`/`TscParser` —
 * `EplValidator` tự tính việc kiểm tra đó, dựa trên cùng tập lệnh đã biết).
 */
export function parseEPL(code: string): EPLParseResult {
  const commands: EPLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let heightDots = 0;

  for (const rawLine of code.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const cmdChar = line[0];
    const rest = line.slice(1).trim();
    commands.push({ cmd: cmdChar, raw: rest });

    switch (cmdChar) {
      case 'N':
        break;

      case 'q':
        widthDots = Number(rest) || widthDots;
        break;

      case 'Q': {
        const parts = rest.split(',');
        heightDots = Number(parts[0]) || heightDots;
        break;
      }

      case 'A': {
        const element = parseTextCommand(line);
        if (element) elements.push(element);
        break;
      }

      case 'X': {
        const element = parseBoxCommand(rest);
        if (element) elements.push(element);
        break;
      }

      case 'L': {
        const element = parseLineCommand(rest);
        if (element) elements.push(element);
        break;
      }

      case 'P':
        break;

      case 'B': // mã vạch 1D — giải mã ở case barcode của EplCompiler, không phải ở đây
      case 'b': // mã vạch 2D — tương tự trên, cho qrcode
      case 'G': // ảnh (GW) — giải mã qua phần tử image riêng, không phải ở đây
      case 'S': // tốc độ in
      case 'D': // độ đậm bản in
      case 'R': // tham chiếu/offset nhãn
      case 'Z': // hướng/chiều in
      case 'O': // tuỳ chọn cấu hình máy in
      case 'J': // điều chỉnh feed theo khe hở/vạch đen của nhãn
      case 'f': // feed một nhãn
      case 'r': // chế độ cảm biến (khe hở hoặc vạch đen)
      case 'I': // truy vấn thông tin máy in
      case 'U': // truy vấn trạng thái máy in
      case 'W': // chế độ tương thích driver Windows
      case 'e': // bật/tắt báo lỗi
      case 'E': // quản lý font mềm đã tải xuống
      case 'F': // quản lý định dạng nhãn đã lưu
      case 'K': // xoá một file đã lưu
      case 'M': // cấu hình dung lượng bộ nhớ đệm
      case 'V': // biến số đã lưu
      case 'C': // trường bộ đếm in
        break;
    }
  }

  return { commands, widthDots, heightDots, elements, warnings };
}

/** Giải mã nguồn EPL2 thành các lệnh có cấu trúc (theo dòng, mỗi dòng một lệnh). */
export class EplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseEPL(code);
  }
}

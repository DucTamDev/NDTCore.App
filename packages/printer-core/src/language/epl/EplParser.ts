import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { Rotation } from '../../types';

/**
 * Một lệnh EPL2 đã giải mã: ký tự lệnh một chữ cái, theo sau là phần văn bản
 * thô trên cùng dòng (đã trim). EPL2 phân tách lệnh bằng dấu xuống dòng thay
 * vì ký tự tiền tố như `^`/`~` của ZPL, nên chỉ cần tách theo dòng, không cần
 * tokenizer đa ký tự.
 */
export interface EPLCommand {
  cmd: string;
  raw: string;
}

export interface EPLParseResult {
  commands: EPLCommand[];
  widthDots: number;
  heightDots: number;
  elements: PrintElement[];
  warnings: string[];
}

const DEFAULT_WIDTH_DOTS = 832;

/**
 * Nghịch đảo của `eplRotation()` trong `EplCompiler` — chuyển mã xoay EPL2
 * (0-3, trường xoay của lệnh `A`) ngược lại thành `Rotation`.
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

/** Ngữ pháp lệnh `A`: `<x>,<y>,<mã xoay 0-3>,<font>,<hệ số ngang>,<hệ số dọc>,<N|R>,"<dữ liệu>"`. */
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

/** Ngữ pháp lệnh `X`: `<x1>,<y1>,<x2>,<y2>,<độ dày>`. */
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

/** Ngữ pháp lệnh `LO`: `<x>,<y>,<width>,<height>`. */
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
 * Một ký tự lệnh không nhận diện được bị bỏ qua âm thầm (không đẩy warning) —
 * khác với `ZplParser`/`TscParser`; việc kiểm tra tập lệnh hợp lệ do
 * `EplValidator` đảm nhiệm riêng.
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

export class EplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseEPL(code);
  }
}

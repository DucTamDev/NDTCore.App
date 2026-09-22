import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';

/**
 * Một lệnh DPL đã giải mã: tag loại nhận diện được và đoạn text thô mà nó
 * khớp — cùng hình dạng `{type, params}` với `parsers/dpl.ts` của portakal.
 */
export interface DPLCommand {
  type: string;
  params: string;
}

/** Kết quả đầy đủ của việc parse một chuỗi mã nguồn DPL. */
export interface DPLParseResult {
  commands: DPLCommand[];
  widthDots: number;
  elements: PrintElement[];
  warnings: string[];
}

// Khớp với giá trị mặc định dự phòng của chính DPL parser bên portakal.
const DEFAULT_WIDTH_DOTS = 832;

/**
 * Độ dài tối thiểu để một dòng bắt đầu bằng chữ số được coi là một bản ghi
 * trường cố định hợp lệ — port nguyên trạng từ ngưỡng của portakal.
 */
const MIN_RECORD_LENGTH = 13;

/**
 * Offset mà DPL parser của portakal đoán là vị trí bắt đầu nội dung text của
 * một bản ghi nhãn, bất kể bố cục trường thật của bản ghi đó (rotation + col
 * + row + height + width + một chữ cái đánh dấu loại bản ghi dài ngắn khác
 * nhau). Nó chỉ đúng một cách tình cờ với một số tổ hợp độ dài trường/font —
 * port nguyên trạng như portakal đang có (xem ghi chú "best-effort, dễ vỡ
 * ngay cả ở bản gốc" trong spec), không sửa lại cho đúng.
 */
const RECORD_CONTENT_OFFSET_GUESS = 20;

const DENSITY_PATTERN = /^D\d{1,2}$/;
const SPEED_PATTERN = /^S\d{1,2}$/;
const WIDTH_PATTERN = /^A\d{4}$/;
const QUANTITY_PATTERN = /^Q\d{4}$/;

function parseDensityCommand(line: string): DPLCommand | null {
  return DENSITY_PATTERN.test(line) ? { type: 'DENSITY', params: line.slice(1) } : null;
}

function parseSpeedCommand(line: string): DPLCommand | null {
  return SPEED_PATTERN.test(line) ? { type: 'SPEED', params: line.slice(1) } : null;
}

function parseWidthCommand(line: string): DPLCommand | null {
  return WIDTH_PATTERN.test(line) ? { type: 'WIDTH', params: line.slice(1) } : null;
}

function parseQuantityCommand(line: string): DPLCommand | null {
  return QUANTITY_PATTERN.test(line) ? { type: 'QUANTITY', params: line.slice(1) } : null;
}

/**
 * Khôi phục best-effort một phần tử `text` từ nội dung ở offset đoán được
 * của bản ghi, theo đúng cách portakal tự làm — trả về `null` khi bản ghi
 * chưa đủ dài để có nội dung, hoặc nội dung đoán được rỗng/không chứa ký tự
 * chữ-số nào.
 */
function extractRecordTextElement(line: string): PrintElement | null {
  if (line.length <= RECORD_CONTENT_OFFSET_GUESS) {
    return null;
  }

  const col = Number(line.slice(1, 5));
  const row = Number(line.slice(5, 9));
  const content = line.slice(Math.min(RECORD_CONTENT_OFFSET_GUESS, line.length));
  if (!content || !/[A-Za-z0-9]/.test(content)) {
    return null;
  }

  return { type: 'text', content, options: { x: col, y: row } };
}

/**
 * Parse một dòng bắt đầu bằng chữ số trong lúc đang ở chế độ nhãn thành một
 * bản ghi `RECORD` cộng phần tử `text` khôi phục được (nếu có). portakal
 * cũng giải mã một giá trị `rotation` ở đây (`Number(line[0])`) nhưng không
 * bao giờ dùng tới — chắc chắn không ảnh hưởng gì nên không port lại.
 */
function parseLabelRecordLine(line: string): { command: DPLCommand | null; element: PrintElement | null } {
  if (line.length < MIN_RECORD_LENGTH) {
    return { command: null, element: null };
  }

  const command: DPLCommand = { type: 'RECORD', params: line };
  const element = extractRecordTextElement(line);
  return { command, element };
}

/**
 * Parse mã nguồn DPL của Honeywell/Datamax thành các lệnh có cấu trúc cộng
 * một tập `PrintElement` khôi phục best-effort — port trực tiếp từ
 * `parseDPL()` của portakal (`parsers/dpl.ts`). Các bản ghi ở chế độ định
 * dạng nhãn không có ký tự tiền tố nào riêng cho từng lệnh để dựa vào (khác
 * với các lệnh một chữ cái của EPL2 hay cú pháp tiền tố `^`/`~` của ZPL);
 * parser này chỉ nhận diện các lệnh thiết lập cấp tài liệu `D`/`S`/`A`/`Q`
 * cộng `STX L`/`E` để vào/thoát chế độ nhãn — mọi dòng bắt đầu bằng chữ số
 * khác đều được đọc như một `RECORD` trường cố định không rõ nghĩa, với việc
 * khôi phục `PrintElement` giới hạn ở đúng cách trích nội dung text theo
 * offset đoán được mà bản thân portakal cũng dùng.
 */
export function parseDPL(code: string): DPLParseResult {
  const commands: DPLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let inLabel = false;

  for (const rawLine of code.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === '\x02L' || line === 'L') {
      inLabel = true;
      commands.push({ type: 'STX_L', params: '' });
      continue;
    }

    if (line === 'E' && inLabel) {
      inLabel = false;
      commands.push({ type: 'E', params: '' });
      continue;
    }

    const densityCommand = parseDensityCommand(line);
    if (densityCommand) {
      commands.push(densityCommand);
      continue;
    }

    const speedCommand = parseSpeedCommand(line);
    if (speedCommand) {
      commands.push(speedCommand);
      continue;
    }

    const widthCommand = parseWidthCommand(line);
    if (widthCommand) {
      widthDots = Number(widthCommand.params);
      commands.push(widthCommand);
      continue;
    }

    const quantityCommand = parseQuantityCommand(line);
    if (quantityCommand) {
      commands.push(quantityCommand);
      continue;
    }

    if (inLabel && /^\d/.test(line)) {
      const { command, element } = parseLabelRecordLine(line);
      if (command) commands.push(command);
      if (element) elements.push(element);
      continue;
    }

    commands.push({ type: 'OTHER', params: line });
  }

  return { commands, widthDots, elements, warnings };
}

/** Giải mã mã nguồn DPL thành các lệnh có cấu trúc. */
export class DplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseDPL(code);
  }
}

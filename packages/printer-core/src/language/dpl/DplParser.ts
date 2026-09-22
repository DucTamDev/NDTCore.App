import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';

/** Một lệnh DPL đã giải mã: `type` là tag nhận diện, `params` là đoạn text thô đã khớp. */
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

// Áp dụng khi mã nguồn không có lệnh WIDTH (`A`).
const DEFAULT_WIDTH_DOTS = 832;

// Ngưỡng heuristic để một dòng số được coi là bản ghi trường cố định hợp lệ,
// không phải giá trị suy trực tiếp từ bố cục trường.
const MIN_RECORD_LENGTH = 13;

/**
 * Offset đoán vị trí bắt đầu nội dung text trong một bản ghi nhãn, bất kể bố
 * cục trường thật (rotation + col + row + height + width + chữ cái đánh dấu
 * loại bản ghi dài ngắn khác nhau). Chỉ đúng tình cờ với một số tổ hợp độ
 * dài trường/font, không phải công thức chính xác — best-effort, dễ vỡ.
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

function extractRecordTextElement(line: string): PrintElement | null {
  if (line.length <= RECORD_CONTENT_OFFSET_GUESS) {
    return null;
  }

  // Index 0 là chữ số rotation của bản ghi (xem `dplRotation` trong
  // DplCompiler) — không dùng tới khi khôi phục toạ độ.
  const col = Number(line.slice(1, 5));
  const row = Number(line.slice(5, 9));
  const content = line.slice(Math.min(RECORD_CONTENT_OFFSET_GUESS, line.length));
  if (!content || !/[A-Za-z0-9]/.test(content)) {
    return null;
  }

  return { type: 'text', content, options: { x: col, y: row } };
}

function parseLabelRecordLine(line: string): { command: DPLCommand | null; element: PrintElement | null } {
  if (line.length < MIN_RECORD_LENGTH) {
    return { command: null, element: null };
  }

  const command: DPLCommand = { type: 'RECORD', params: line };
  const element = extractRecordTextElement(line);
  return { command, element };
}

/**
 * Parse mã nguồn DPL (Honeywell/Datamax) thành các lệnh có cấu trúc cộng một
 * tập `PrintElement` khôi phục best-effort.
 *
 * Bản ghi ở chế độ định dạng nhãn không có ký tự tiền tố riêng cho từng lệnh
 * (khác lệnh một chữ cái của EPL2 hay tiền tố `^`/`~` của ZPL) — parser chỉ
 * nhận diện lệnh thiết lập cấp tài liệu `D`/`S`/`A`/`Q` cộng `STX L`/`E`; mọi
 * dòng số khác được đọc như một `RECORD` trường cố định không rõ nghĩa, với
 * việc khôi phục `PrintElement` giới hạn ở offset đoán trong
 * `RECORD_CONTENT_OFFSET_GUESS`.
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

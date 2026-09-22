import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { Alignment } from '../../types';
import { BYTE_VALUE_RANGE, STAR_PRNT, STAR_PRNT_ALIGN_VALUE } from './StarPrntCommand';

/** Một lệnh Star Line Mode đã giải mã: tên gợi nhớ và bytes gốc. */
export interface StarPrntParsedCommand {
  name: string;
  bytes: number[];
}

/** Toàn bộ kết quả giải mã 1 luồng byte Star Line Mode. */
export interface StarPrntParseResult {
  commands: StarPrntParsedCommand[];
  elements: PrintElement[];
  warnings: string[];
}

/** Trạng thái căn lề/in đậm đang áp dụng khi giải mã tuần tự luồng byte. */
interface StarPrntParserState {
  currentAlign: Alignment;
  isBold: boolean;
}

/**
 * Kết quả giải mã 1 lệnh bắt đầu bằng ESC: các command đọc được và vị trí
 * kế tiếp trong luồng byte.
 */
interface EscapeCommandStep {
  commands: StarPrntParsedCommand[];
  nextIndex: number;
}

/** Kết quả giải mã 1 đoạn văn bản in được liên tiếp. */
interface TextRunStep {
  command: StarPrntParsedCommand;
  element: PrintElement;
  nextIndex: number;
}

const PRINTABLE_ASCII_MIN = 0x20;
const PRINTABLE_ASCII_MAX = 0x7e;

function isPrintableAscii(byte: number): boolean {
  return byte >= PRINTABLE_ASCII_MIN && byte <= PRINTABLE_ASCII_MAX;
}

/** So khớp dãy byte liên tiếp trong `data` bắt đầu từ `startIndex` với `sequence`. */
function matchesByteSequence(data: Uint8Array, startIndex: number, sequence: readonly number[]): boolean {
  if (startIndex + sequence.length > data.length) return false;
  return sequence.every((byte, offset) => data[startIndex + offset] === byte);
}

function parseInitCommand(index: number, state: StarPrntParserState): EscapeCommandStep {
  state.currentAlign = 'left';
  state.isBold = false;
  return {
    commands: [{ name: 'ESC @', bytes: [STAR_PRNT.ESC, STAR_PRNT.INIT] }],
    nextIndex: index + 2,
  };
}

function parseAlignCommand(data: Uint8Array, index: number, state: StarPrntParserState): EscapeCommandStep {
  const alignValue = data[index + 3]!;
  state.currentAlign =
    alignValue === STAR_PRNT_ALIGN_VALUE.CENTER
      ? 'center'
      : alignValue === STAR_PRNT_ALIGN_VALUE.RIGHT
        ? 'right'
        : 'left';

  return {
    commands: [{ name: 'ESC GS a', bytes: [STAR_PRNT.ESC, ...STAR_PRNT.ALIGN, alignValue] }],
    nextIndex: index + 4,
  };
}

function parseBoldOnCommand(index: number, state: StarPrntParserState): EscapeCommandStep {
  state.isBold = true;
  return {
    commands: [{ name: 'ESC E', bytes: [STAR_PRNT.ESC, STAR_PRNT.BOLD_ON] }],
    nextIndex: index + 2,
  };
}

function parseBoldOffCommand(index: number, state: StarPrntParserState): EscapeCommandStep {
  state.isBold = false;
  return {
    commands: [{ name: 'ESC F', bytes: [STAR_PRNT.ESC, STAR_PRNT.BOLD_OFF] }],
    nextIndex: index + 2,
  };
}

function parseUnderlineCommand(data: Uint8Array, index: number): EscapeCommandStep {
  return {
    commands: [{ name: 'ESC -', bytes: [STAR_PRNT.ESC, STAR_PRNT.UNDERLINE, data[index + 2]!] }],
    nextIndex: index + 3,
  };
}

function parseSizeCommand(data: Uint8Array, index: number): EscapeCommandStep {
  return {
    commands: [{ name: 'ESC i', bytes: [STAR_PRNT.ESC, STAR_PRNT.SIZE, data[index + 2]!, data[index + 3]!] }],
    nextIndex: index + 4,
  };
}

function parseCutCommand(data: Uint8Array, index: number): EscapeCommandStep {
  return {
    commands: [{ name: 'ESC d', bytes: [STAR_PRNT.ESC, STAR_PRNT.CUT, data[index + 2]!] }],
    nextIndex: index + 3,
  };
}

/**
 * Giải mã 1 khối raster ảnh: "ESC * r A" mở đầu, các bản ghi "b nL nH data"
 * (mỗi bản ghi ứng với 1 hàng ảnh), rồi "ESC * r B" kết thúc. Nếu dữ liệu bị
 * cắt cụt và không có "ESC * r B", vòng lặp chỉ dừng khi hết dữ liệu — giữ
 * nguyên cách xử lý khoan dung này của bản gốc.
 */
function parseRasterBlock(data: Uint8Array, index: number): EscapeCommandStep {
  const commands: StarPrntParsedCommand[] = [{ name: 'ESC * r A', bytes: [STAR_PRNT.ESC, ...STAR_PRNT.RASTER_ENTER] }];
  let cursor = index + 4;

  while (cursor < data.length) {
    if (data[cursor] === STAR_PRNT.ESC && matchesByteSequence(data, cursor + 1, STAR_PRNT.RASTER_EXIT)) {
      commands.push({ name: 'ESC * r B', bytes: [STAR_PRNT.ESC, ...STAR_PRNT.RASTER_EXIT] });
      cursor += 4;
      break;
    }

    if (data[cursor] === STAR_PRNT.RASTER_LINE && cursor + 2 < data.length) {
      const rowLengthLowByte = data[cursor + 1]!;
      const rowLengthHighByte = data[cursor + 2]!;
      const rowLength = rowLengthLowByte + rowLengthHighByte * BYTE_VALUE_RANGE;
      commands.push({ name: 'b', bytes: [STAR_PRNT.RASTER_LINE, rowLengthLowByte, rowLengthHighByte] });
      cursor += 3 + rowLength;
      continue;
    }

    cursor++;
  }

  return { commands, nextIndex: cursor };
}

function parseGenericEscapeCommand(data: Uint8Array, index: number): EscapeCommandStep {
  const commandByte = data[index + 1]!;
  return {
    commands: [{ name: `ESC ${String.fromCharCode(commandByte)}`, bytes: [STAR_PRNT.ESC, commandByte] }],
    nextIndex: index + 2,
  };
}

/** Phân loại 1 lệnh ESC theo byte lệnh theo sau, rồi giao lại cho hàm parse tương ứng. */
function parseEscapeSequence(data: Uint8Array, index: number, state: StarPrntParserState): EscapeCommandStep {
  const commandByte = data[index + 1]!;

  if (commandByte === STAR_PRNT.INIT) return parseInitCommand(index, state);

  if (matchesByteSequence(data, index + 1, STAR_PRNT.ALIGN) && index + 3 < data.length) {
    return parseAlignCommand(data, index, state);
  }

  if (commandByte === STAR_PRNT.BOLD_ON) return parseBoldOnCommand(index, state);
  if (commandByte === STAR_PRNT.BOLD_OFF) return parseBoldOffCommand(index, state);
  if (commandByte === STAR_PRNT.UNDERLINE && index + 2 < data.length) return parseUnderlineCommand(data, index);
  if (commandByte === STAR_PRNT.SIZE && index + 3 < data.length) return parseSizeCommand(data, index);
  if (commandByte === STAR_PRNT.CUT && index + 2 < data.length) return parseCutCommand(data, index);
  if (matchesByteSequence(data, index + 1, STAR_PRNT.RASTER_ENTER)) return parseRasterBlock(data, index);

  return parseGenericEscapeCommand(data, index);
}

function parseTextRun(data: Uint8Array, index: number, state: StarPrntParserState): TextRunStep {
  let text = '';
  let cursor = index;

  while (cursor < data.length && isPrintableAscii(data[cursor]!)) {
    text += String.fromCharCode(data[cursor]!);
    cursor++;
  }

  const command: StarPrntParsedCommand = { name: 'TEXT', bytes: Array.from(new TextEncoder().encode(text)) };
  const element: PrintElement = {
    type: 'text',
    content: text,
    options: { align: state.currentAlign, bold: state.isBold || undefined },
  };

  return { command, element, nextIndex: cursor };
}

/**
 * Giải mã 1 luồng byte Star Line Mode thành các command cộng `PrintElement`
 * khôi phục được. Export cùng lớp bọc bên dưới để phía nhận byte-in —
 * chẳng hạn mục nguồn starprnt của `ConversionRegistry` — có thể gọi thẳng
 * dưới dạng hàm thuần, cùng kiểu mà parser của mọi ngôn ngữ khác cung cấp.
 */
export function decodeStarPrnt(data: Uint8Array): StarPrntParseResult {
  const commands: StarPrntParsedCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  const state: StarPrntParserState = { currentAlign: 'left', isBold: false };
  let index = 0;

  while (index < data.length) {
    const byte = data[index]!;

    if (byte === STAR_PRNT.ESC && index + 1 < data.length) {
      const step = parseEscapeSequence(data, index, state);
      commands.push(...step.commands);
      index = step.nextIndex;
      continue;
    }

    if (byte === STAR_PRNT.CASH_DRAWER) {
      commands.push({ name: 'BEL', bytes: [STAR_PRNT.CASH_DRAWER] });
      index++;
      continue;
    }

    if (byte === STAR_PRNT.LF) {
      commands.push({ name: 'LF', bytes: [STAR_PRNT.LF] });
      index++;
      continue;
    }

    if (isPrintableAscii(byte)) {
      const run = parseTextRun(data, index, state);
      commands.push(run.command);
      elements.push(run.element);
      index = run.nextIndex;
      continue;
    }

    index++;
  }

  return { commands, elements, warnings };
}

/**
 * Giải mã 1 luồng byte Star Line Mode thành các command có cấu trúc. Port
 * trực tiếp từ `parseStarPRNT()` của portakal.
 */
export class StarPrntParser implements PrintParser<StarPrntParseResult> {
  parse(source: string | Uint8Array): StarPrntParseResult {
    const bytes = typeof source === 'string' ? new TextEncoder().encode(source) : source;
    return decodeStarPrnt(bytes);
  }
}

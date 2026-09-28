import type { PrintParseResult, PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements';
import { binaryStringToBytes } from '../../encoding';
import { ESC_POS } from './EscPosCommand';
import { EscPosFontMetrics } from './EscPosFontMetrics';

/** 1 lệnh ESC/POS đọc được. */
export interface EscPosParsedCommand {
  /** Tên lệnh, VD `LF`. */
  name: string;

  /** Byte gốc của lệnh. */
  bytes: number[];

  /** Tham số đã giải mã; field riêng theo từng lệnh. */
  params: Record<string, unknown>;
}

// Không có trong ESC_POS dùng chung vì đó chỉ chứa byte mà compiler cần phát ra.
const DLE_PREFIX = 0x10;
const FS_PREFIX = 0x1c;

const PRINTABLE_ASCII_MIN = 0x20;
const PRINTABLE_ASCII_MAX = 0x7e;

// Byte lệnh con của ESC, không trùng với ESC_POS.
const ESC_FONT = 0x4d;
const ESC_PRINT_MODE = 0x21;
const ESC_ROTATION = 0x56;
const ESC_UPSIDE_DOWN = 0x7b;
const ESC_FEED_LINES = 0x64;
const ESC_FEED_DOTS = 0x4a;
const ESC_CODE_PAGE = 0x74;
const ESC_PULSE = 0x70;

// Byte lệnh con của GS, không trùng với ESC_POS.
const GS_FONT = 0x66;
const GS_AUTO_STATUS_BACK = 0x61;
const GS_PAPER_SENSOR = 0x72;

/** Mặt nạ/độ dịch bit để giải nén hệ số phóng to width/height từ 2 nibble của GS ! n. */
const SIZE_NIBBLE_MASK = 0x07;
const SIZE_NIBBLE_SHIFT = 4;

/** Ngưỡng "m" của GS k: format A kết thúc bằng NUL, format B có tiền tố độ dài. */
const GS_K_FORMAT_B_MIN = 65;

/** Giá trị "m" của GS V đánh dấu function B (feed n dòng rồi cắt), phân biệt với function A. */
const CUT_FUNCTION_B_FULL = 0x41;
const CUT_FUNCTION_B_PARTIAL = 0x42;

/** Hệ số ghép byte thấp/cao thành số 16-bit little-endian. */
const BYTE_RANGE = 256;

// Byte lệnh con của DLE.
const DLE_REAL_TIME_STATUS = 0x04;
const DLE_REAL_TIME_REQUEST = 0x05;
const DLE_REAL_TIME_SETTING = 0x14;

/** Tích luỹ qua các lệnh ESC/GS, được đọc lại khi gặp đoạn text in được để dựng `TextElement`. */
interface TextRunState {
  align: 'left' | 'center' | 'right';
  bold: boolean;
  underline: boolean;
  sizeWidth: number;
  sizeHeight: number;
}

function createInitialTextRunState(): TextRunState {
  return { align: 'left', bold: false, underline: false, sizeWidth: 1, sizeHeight: 1 };
}

function resetTextRunState(state: TextRunState): void {
  state.align = 'left';
  state.bold = false;
  state.underline = false;
  state.sizeWidth = 1;
  state.sizeHeight = 1;
}

function decodeAlign(value: number): 'left' | 'center' | 'right' {
  if (value === 1) return 'center';
  if (value === 2) return 'right';
  return 'left';
}

function isPrintableAscii(byte: number): boolean {
  return byte >= PRINTABLE_ASCII_MIN && byte <= PRINTABLE_ASCII_MAX;
}

/** Parse "GS k" (barcode): format B (m >= 65, có tiền tố độ dài) hoặc format A (kết thúc bằng NUL). */
function parseBarcodeCommand(data: Uint8Array, offset: number, commands: EscPosParsedCommand[]): number {
  if (offset + 2 >= data.length) return offset + 2;

  const symbology = data[offset + 2]!;

  if (symbology >= GS_K_FORMAT_B_MIN) {
    if (offset + 3 >= data.length) return offset + 3;

    const length = data[offset + 3]!;
    const barcodeData = data.slice(offset + 4, offset + 4 + length);
    commands.push({
      name: 'GS k',
      bytes: Array.from(data.slice(offset, offset + 4 + length)),
      params: { type: symbology, length, data: new TextDecoder().decode(barcodeData) },
    });
    return offset + 4 + length;
  }

  const dataStart = offset + 3;
  let dataEnd = dataStart;
  while (dataEnd < data.length && data[dataEnd] !== 0) dataEnd++;

  commands.push({
    name: 'GS k',
    bytes: Array.from(data.slice(offset, dataEnd + 1)),
    params: { type: symbology, data: new TextDecoder().decode(data.slice(dataStart, dataEnd)) },
  });
  return dataEnd + 1;
}

/** Parse "GS V" (cắt giấy): function A (cắt ngay, không feed) hoặc function B (feed n dòng rồi cắt). */
function parseCutCommand(data: Uint8Array, offset: number, commands: EscPosParsedCommand[]): number {
  if (offset + 2 >= data.length) return offset + 2;

  const mode = data[offset + 2]!;
  const hasFeedParam = mode === CUT_FUNCTION_B_FULL || mode === CUT_FUNCTION_B_PARTIAL;

  if (!hasFeedParam) {
    commands.push({ name: 'GS V', bytes: [ESC_POS.GS, ESC_POS.CUT, mode], params: { mode } });
    return offset + 3;
  }

  if (offset + 3 >= data.length) return offset + 3;

  const feed = data[offset + 3]!;
  commands.push({ name: 'GS V', bytes: [ESC_POS.GS, ESC_POS.CUT, mode, feed], params: { mode, feed } });
  return offset + 4;
}

/** Parse "GS v 0" (ảnh raster): đọc header 8 byte rồi tính độ dài payload từ bytesPerRow × rows. */
function parseRasterImageCommand(data: Uint8Array, offset: number, commands: EscPosParsedCommand[]): number {
  const hasFullHeader = offset + 7 < data.length && data[offset + 2] === ESC_POS.RASTER_IMAGE[1];
  if (!hasFullHeader) return offset + 2;

  const mode = data[offset + 3]!;
  const widthLow = data[offset + 4]!;
  const widthHigh = data[offset + 5]!;
  const heightLow = data[offset + 6]!;
  const heightHigh = data[offset + 7]!;
  const bytesPerRow = widthLow + widthHigh * BYTE_RANGE;
  const rows = heightLow + heightHigh * BYTE_RANGE;
  const dataLength = bytesPerRow * rows;

  commands.push({
    name: 'GS v 0',
    bytes: Array.from(data.slice(offset, offset + 8)),
    params: { mode, bytesPerRow, rows, dataLength },
  });
  return offset + 8 + dataLength;
}

/**
 * Parse "GS ( k" (mã 2D — QR code, v.v.): sub-function "store data" (fn=k, có payload) hoặc các
 * sub-function khác.
 */
function parseTwoDCodeCommand(data: Uint8Array, offset: number, commands: EscPosParsedCommand[]): number {
  if (offset + 2 >= data.length) return offset + 2;

  const subFunction = data[offset + 2]!;
  const hasLengthPrefixedPayload = subFunction === ESC_POS.TWO_D_CODE[1] && offset + 4 < data.length;

  if (!hasLengthPrefixedPayload) {
    commands.push({
      name: `GS ( ${String.fromCharCode(subFunction)}`,
      bytes: [ESC_POS.GS, ESC_POS.TWO_D_CODE[0], subFunction],
      params: {},
    });
    return offset + 3;
  }

  const lengthLow = data[offset + 3]!;
  const lengthHigh = data[offset + 4]!;
  const length = lengthLow + lengthHigh * BYTE_RANGE;

  commands.push({
    name: 'GS ( k',
    bytes: Array.from(data.slice(offset, offset + 5 + length)),
    params: { function: subFunction, length },
  });
  return offset + 5 + length;
}

/** Parse một lệnh bắt đầu bằng ESC (0x1b) — `offset` trỏ vào chính byte ESC. */
function parseEscCommand(
  data: Uint8Array,
  offset: number,
  state: TextRunState,
  commands: EscPosParsedCommand[],
): number {
  const commandByte = data[offset + 1]!;

  switch (commandByte) {
    case ESC_POS.INIT:
      commands.push({ name: 'ESC @', bytes: [ESC_POS.ESC, ESC_POS.INIT], params: {} });
      resetTextRunState(state);
      return offset + 2;

    case ESC_POS.ALIGN: {
      if (offset + 2 >= data.length) return offset + 2;
      const value = data[offset + 2]!;
      state.align = decodeAlign(value);
      commands.push({ name: 'ESC a', bytes: [ESC_POS.ESC, ESC_POS.ALIGN, value], params: { align: state.align } });
      return offset + 3;
    }

    case ESC_POS.BOLD: {
      if (offset + 2 >= data.length) return offset + 2;
      const value = data[offset + 2]!;
      state.bold = value !== 0;
      commands.push({ name: 'ESC E', bytes: [ESC_POS.ESC, ESC_POS.BOLD, value], params: { bold: state.bold } });
      return offset + 3;
    }

    case ESC_POS.UNDERLINE: {
      if (offset + 2 >= data.length) return offset + 2;
      const value = data[offset + 2]!;
      state.underline = value !== 0;
      commands.push({
        name: 'ESC -',
        bytes: [ESC_POS.ESC, ESC_POS.UNDERLINE, value],
        params: { underline: state.underline },
      });
      return offset + 3;
    }

    case ESC_FONT: {
      if (offset + 2 >= data.length) return offset + 2;
      const font = data[offset + 2]!;
      commands.push({ name: 'ESC M', bytes: [ESC_POS.ESC, ESC_FONT, font], params: { font } });
      return offset + 3;
    }

    case ESC_PRINT_MODE: {
      if (offset + 2 >= data.length) return offset + 2;
      const mode = data[offset + 2]!;
      commands.push({ name: 'ESC !', bytes: [ESC_POS.ESC, ESC_PRINT_MODE, mode], params: { mode } });
      return offset + 3;
    }

    case ESC_ROTATION: {
      if (offset + 2 >= data.length) return offset + 2;
      const rotation = data[offset + 2]!;
      commands.push({ name: 'ESC V', bytes: [ESC_POS.ESC, ESC_ROTATION, rotation], params: { rotation } });
      return offset + 3;
    }

    case ESC_UPSIDE_DOWN: {
      if (offset + 2 >= data.length) return offset + 2;
      const value = data[offset + 2]!;
      commands.push({
        name: 'ESC {',
        bytes: [ESC_POS.ESC, ESC_UPSIDE_DOWN, value],
        params: { upsideDown: value !== 0 },
      });
      return offset + 3;
    }

    case ESC_FEED_LINES: {
      if (offset + 2 >= data.length) return offset + 2;
      const lines = data[offset + 2]!;
      commands.push({ name: 'ESC d', bytes: [ESC_POS.ESC, ESC_FEED_LINES, lines], params: { lines } });
      return offset + 3;
    }

    case ESC_FEED_DOTS: {
      if (offset + 2 >= data.length) return offset + 2;
      const dots = data[offset + 2]!;
      commands.push({ name: 'ESC J', bytes: [ESC_POS.ESC, ESC_FEED_DOTS, dots], params: { dots } });
      return offset + 3;
    }

    case ESC_POS.LINE_SPACING_SET: {
      if (offset + 2 >= data.length) return offset + 2;
      const spacing = data[offset + 2]!;
      commands.push({
        name: 'ESC 3',
        bytes: [ESC_POS.ESC, ESC_POS.LINE_SPACING_SET, spacing],
        params: { spacing },
      });
      return offset + 3;
    }

    case ESC_POS.LINE_SPACING_DEFAULT:
      commands.push({ name: 'ESC 2', bytes: [ESC_POS.ESC, ESC_POS.LINE_SPACING_DEFAULT], params: {} });
      return offset + 2;

    case ESC_CODE_PAGE: {
      if (offset + 2 >= data.length) return offset + 2;
      const codePage = data[offset + 2]!;
      commands.push({ name: 'ESC t', bytes: [ESC_POS.ESC, ESC_CODE_PAGE, codePage], params: { codePage } });
      return offset + 3;
    }

    case ESC_PULSE: {
      if (offset + 4 >= data.length) return offset + 2;
      commands.push({
        name: 'ESC p',
        bytes: [ESC_POS.ESC, ESC_PULSE, data[offset + 2]!, data[offset + 3]!, data[offset + 4]!],
        params: { pin: data[offset + 2], onTime: data[offset + 3], offTime: data[offset + 4] },
      });
      return offset + 5;
    }

    default:
      commands.push({ name: `ESC ${String.fromCharCode(commandByte)}`, bytes: [ESC_POS.ESC, commandByte], params: {} });
      return offset + 2;
  }
}

/** Parse một lệnh bắt đầu bằng GS (0x1d) — `offset` trỏ vào chính byte GS. */
function parseGsCommand(
  data: Uint8Array,
  offset: number,
  state: TextRunState,
  commands: EscPosParsedCommand[],
): number {
  const commandByte = data[offset + 1]!;

  switch (commandByte) {
    case ESC_POS.SIZE: {
      if (offset + 2 >= data.length) return offset + 2;
      const value = data[offset + 2]!;
      // Giải nén nibble cao/thấp của GS ! n thành hệ số phóng to chiều rộng/chiều cao, theo spec.
      // eslint-disable-next-line no-bitwise
      state.sizeWidth = ((value >> SIZE_NIBBLE_SHIFT) & SIZE_NIBBLE_MASK) + 1;
      // eslint-disable-next-line no-bitwise
      state.sizeHeight = (value & SIZE_NIBBLE_MASK) + 1;
      commands.push({
        name: 'GS !',
        bytes: [ESC_POS.GS, ESC_POS.SIZE, value],
        params: { width: state.sizeWidth, height: state.sizeHeight },
      });
      return offset + 3;
    }

    case ESC_POS.REVERSE: {
      if (offset + 2 >= data.length) return offset + 2;
      const value = data[offset + 2]!;
      commands.push({ name: 'GS B', bytes: [ESC_POS.GS, ESC_POS.REVERSE, value], params: { reverse: value !== 0 } });
      return offset + 3;
    }

    case ESC_POS.HRI_POSITION: {
      if (offset + 2 >= data.length) return offset + 2;
      const position = data[offset + 2]!;
      commands.push({ name: 'GS H', bytes: [ESC_POS.GS, ESC_POS.HRI_POSITION, position], params: { position } });
      return offset + 3;
    }

    case ESC_POS.BARCODE_HEIGHT: {
      if (offset + 2 >= data.length) return offset + 2;
      const height = data[offset + 2]!;
      commands.push({ name: 'GS h', bytes: [ESC_POS.GS, ESC_POS.BARCODE_HEIGHT, height], params: { height } });
      return offset + 3;
    }

    case ESC_POS.BARCODE_WIDTH: {
      if (offset + 2 >= data.length) return offset + 2;
      const width = data[offset + 2]!;
      commands.push({ name: 'GS w', bytes: [ESC_POS.GS, ESC_POS.BARCODE_WIDTH, width], params: { width } });
      return offset + 3;
    }

    case GS_FONT: {
      if (offset + 2 >= data.length) return offset + 2;
      const font = data[offset + 2]!;
      commands.push({ name: 'GS f', bytes: [ESC_POS.GS, GS_FONT, font], params: { font } });
      return offset + 3;
    }

    case ESC_POS.BARCODE:
      return parseBarcodeCommand(data, offset, commands);

    case ESC_POS.CUT:
      return parseCutCommand(data, offset, commands);

    case ESC_POS.RASTER_IMAGE[0]:
      return parseRasterImageCommand(data, offset, commands);

    case ESC_POS.TWO_D_CODE[0]:
      return parseTwoDCodeCommand(data, offset, commands);

    case GS_AUTO_STATUS_BACK: {
      if (offset + 2 >= data.length) return offset + 2;
      const enable = data[offset + 2]!;
      commands.push({ name: 'GS a', bytes: [ESC_POS.GS, GS_AUTO_STATUS_BACK, enable], params: { enable } });
      return offset + 3;
    }

    case GS_PAPER_SENSOR: {
      if (offset + 2 >= data.length) return offset + 2;
      const type = data[offset + 2]!;
      commands.push({ name: 'GS r', bytes: [ESC_POS.GS, GS_PAPER_SENSOR, type], params: { type } });
      return offset + 3;
    }

    default:
      commands.push({ name: `GS ${String.fromCharCode(commandByte)}`, bytes: [ESC_POS.GS, commandByte], params: {} });
      return offset + 2;
  }
}

/** Parse một lệnh bắt đầu bằng DLE (0x10) — real-time status request, không ảnh hưởng text state. */
function parseDleCommand(data: Uint8Array, offset: number, commands: EscPosParsedCommand[]): number {
  const commandByte = data[offset + 1]!;

  if (commandByte === DLE_REAL_TIME_STATUS && offset + 2 < data.length) {
    const statusType = data[offset + 2]!;
    commands.push({
      name: 'DLE EOT',
      bytes: [DLE_PREFIX, DLE_REAL_TIME_STATUS, statusType],
      params: { type: statusType },
    });
    return offset + 3;
  }

  if (commandByte === DLE_REAL_TIME_REQUEST && offset + 2 < data.length) {
    const requestType = data[offset + 2]!;
    commands.push({
      name: 'DLE ENQ',
      bytes: [DLE_PREFIX, DLE_REAL_TIME_REQUEST, requestType],
      params: { type: requestType },
    });
    return offset + 3;
  }

  if (commandByte === DLE_REAL_TIME_SETTING && offset + 4 < data.length) {
    commands.push({
      name: 'DLE DC4',
      bytes: [DLE_PREFIX, DLE_REAL_TIME_SETTING, data[offset + 2]!, data[offset + 3]!, data[offset + 4]!],
      params: { fn: data[offset + 2], m: data[offset + 3], t: data[offset + 4] },
    });
    return offset + 5;
  }

  return offset + 2;
}

/** Parse một lệnh bắt đầu bằng FS (0x1c) — chưa decode tham số, chỉ ghi nhận mnemonic. */
function parseFsCommand(data: Uint8Array, offset: number, commands: EscPosParsedCommand[]): number {
  const commandByte = data[offset + 1]!;
  commands.push({ name: `FS ${String.fromCharCode(commandByte)}`, bytes: [FS_PREFIX, commandByte], params: {} });
  return offset + 2;
}

function parseTextRun(
  data: Uint8Array,
  offset: number,
  state: TextRunState,
  commands: EscPosParsedCommand[],
  elements: PrintElement[],
): number {
  let text = '';
  let cursor = offset;

  while (cursor < data.length && isPrintableAscii(data[cursor]!)) {
    text += String.fromCharCode(data[cursor]!);
    cursor++;
  }

  commands.push({ name: 'TEXT', bytes: Array.from(new TextEncoder().encode(text)), params: { text } });
  elements.push({
    type: 'text',
    content: text,
    options: {
      align: state.align,
      bold: state.bold || undefined,
      underline: state.underline || undefined,
      fontSize: EscPosFontMetrics.magnificationToFontSize(Math.max(state.sizeWidth, state.sizeHeight)),
    },
  });

  return cursor;
}

function decodeEscPos(data: Uint8Array): PrintParseResult<EscPosParsedCommand> {
  const commands: EscPosParsedCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  const state = createInitialTextRunState();
  let offset = 0;

  while (offset < data.length) {
    const byte = data[offset]!;

    if (byte === ESC_POS.ESC && offset + 1 < data.length) {
      offset = parseEscCommand(data, offset, state, commands);
      continue;
    }

    if (byte === ESC_POS.GS && offset + 1 < data.length) {
      offset = parseGsCommand(data, offset, state, commands);
      continue;
    }

    if (byte === DLE_PREFIX && offset + 1 < data.length) {
      offset = parseDleCommand(data, offset, commands);
      continue;
    }

    if (byte === FS_PREFIX && offset + 1 < data.length) {
      offset = parseFsCommand(data, offset, commands);
      continue;
    }

    if (byte === ESC_POS.LF) {
      commands.push({ name: 'LF', bytes: [ESC_POS.LF], params: {} });
      offset++;
      continue;
    }

    if (isPrintableAscii(byte)) {
      offset = parseTextRun(data, offset, state, commands, elements);
      continue;
    }

    offset++;
  }

  return { commands, elements, warnings };
}

/** Đọc lệnh ESC/POS; chuỗi được hiểu theo quy ước 1 ký tự = 1 byte, giống output chuỗi của `convert()`. */
export class EscPosParser implements PrintParser<EscPosParsedCommand> {
  parse(source: string | Uint8Array): PrintParseResult<EscPosParsedCommand> {
    const bytes = typeof source === 'string' ? binaryStringToBytes(source) : source;
    return decodeEscPos(bytes);
  }
}

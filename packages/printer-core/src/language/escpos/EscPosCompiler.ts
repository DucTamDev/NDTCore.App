import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { TextOptions } from '../../document/elements/content/TextElement';
import type { CutOptions } from '../../document/elements/control/CutElement';
import type { TableOptions } from '../../document/elements/layout/TableElement';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';
import { encodeEscPosText } from './EscPosCodePage';
import { encodeEscPosImage } from './EscPosImageEncoder';
import { encodeEscPosBarcode } from './EscPosBarcodeEncoder';
import { encodeEscPosQrCode } from './EscPosQrCodeEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

/** Giá trị "n" của ESC a n (căn lề). */
const ALIGN_LEFT = 0;
const ALIGN_CENTER = 1;
const ALIGN_RIGHT = 2;

/** Giá trị cờ bật/tắt dùng chung cho ESC E n / ESC - n / GS B n (bold, underline, reverse). */
const FEATURE_ON = 1;
const FEATURE_OFF = 0;

/** Mặt nạ/độ dịch bit dùng để đóng gói hệ số phóng to width/height vào 2 nibble của GS ! n. */
const SIZE_MAGNIFICATION_MASK = 0x07;
const SIZE_HEIGHT_NIBBLE_SHIFT = 4;

/**
 * Giá trị "m" của GS V m [n] — chọn cắt toàn phần/một phần cho từng dạng lệnh
 * (function A không feed, function B có feed).
 */
const CUT_FUNCTION_A_FULL = 0;
const CUT_FUNCTION_A_PARTIAL = 1;
const CUT_FUNCTION_B_FULL = 0x41;
const CUT_FUNCTION_B_PARTIAL = 0x42;

function alignByte(align: TextOptions['align']): number {
  switch (align) {
    case 'center':
      return ALIGN_CENTER;
    case 'right':
      return ALIGN_RIGHT;
    default:
      return ALIGN_LEFT;
  }
}

function compileTextElement(
  content: string,
  rawOptions: TextOptions | undefined,
  encoding: TextEncodingOptions | undefined,
): Uint8Array[] {
  const options = rawOptions ?? {};
  const chunks: Uint8Array[] = [];

  chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.ALIGN, alignByte(options.align)]));

  if (options.bold) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.BOLD, FEATURE_ON]));
  if (options.underline) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.UNDERLINE, FEATURE_ON]));

  if (options.size !== undefined && options.size > 1) {
    const magnification = options.size - 1;
    // GS ! n đóng nibble cao=height, nibble thấp=width — ở đây dùng chung 1 giá trị magnification.
    // eslint-disable-next-line no-bitwise
    const nibble = magnification & SIZE_MAGNIFICATION_MASK;
    // eslint-disable-next-line no-bitwise
    const sizeByte = (nibble << SIZE_HEIGHT_NIBBLE_SHIFT) | nibble;
    chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, sizeByte]));
  }

  if (options.reverse) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.REVERSE, FEATURE_ON]));

  chunks.push(encodeEscPosText(content, encoding));
  chunks.push(new Uint8Array([ESC_POS.LF]));

  if (options.bold) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.BOLD, FEATURE_OFF]));
  if (options.underline) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.UNDERLINE, FEATURE_OFF]));
  if (options.size !== undefined && options.size > 1) {
    chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, FEATURE_OFF]));
  }
  if (options.reverse) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.REVERSE, FEATURE_OFF]));
  chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.ALIGN, ALIGN_LEFT]));

  return chunks;
}

function compileCutElement(options: CutOptions | undefined): Uint8Array[] {
  const mode = options?.mode ?? 'full';
  if (mode === 'off') return [];

  const rows = options?.rows;
  if (rows !== undefined) {
    // GS V m n (function B): feed n dòng rồi cắt — m chọn full/partial.
    const functionByte = mode === 'partial' ? CUT_FUNCTION_B_PARTIAL : CUT_FUNCTION_B_FULL;
    return [new Uint8Array([ESC_POS.GS, ESC_POS.CUT, functionByte, rows])];
  }

  // GS V m (function A): cắt ngay tại vị trí hiện tại, không feed — m chọn full/partial.
  const functionByte = mode === 'partial' ? CUT_FUNCTION_A_PARTIAL : CUT_FUNCTION_A_FULL;
  return [new Uint8Array([ESC_POS.GS, ESC_POS.CUT, functionByte])];
}

function compileTableElement(options: TableOptions, encoding: TextEncodingOptions | undefined): Uint8Array[] {
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const lines = formatTable(options.columns, options.rows, totalWidth);

  const chunks: Uint8Array[] = [];
  for (const line of lines) chunks.push(...compileTextElement(line, undefined, encoding));
  return chunks;
}

function compileElement(element: PrintElement, encoding: TextEncodingOptions | undefined): Uint8Array[] {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options, encoding);

    case 'image':
      return [encodeEscPosImage(element.bitmap)];

    case 'barcode':
      return [encodeEscPosBarcode(element.options)];

    case 'qrcode':
      return [encodeEscPosQrCode(element.options)];

    case 'raw':
      return [typeof element.content === 'string' ? encodeEscPosText(element.content, encoding) : element.content];

    // ESC/POS không có lệnh vẽ vector nguyên sinh nên các element này là no-op có chủ đích, không phải thiếu sót.
    case 'box':
    case 'line':
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return [];

    // Package chưa có engine auto-layout hàng-cột — placeholder chờ thiết kế, không phải bug.
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return [];

    case 'cut':
      return compileCutElement(element.options);

    case 'table':
      return compileTableElement(element.options, encoding);
  }
}

export class EscPosCompiler implements PrintCompiler<Uint8Array> {
  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): Uint8Array {
    const chunks: Uint8Array[] = [new Uint8Array([ESC_POS.ESC, ESC_POS.INIT])];

    for (const element of document.elements) {
      chunks.push(...compileElement(element, encoding));
    }

    return concatEscPosBytes(chunks);
  }
}

import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement, TextOptions, CutOptions, TableOptions } from '../../document/elements';
import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';
import { encodeEscPosText } from './EscPosCodePage';
import { encodeEscPosImage } from './EscPosImageEncoder';
import { encodeEscPosBarcode } from './EscPosBarcodeEncoder';
import { encodeEscPosQrCode } from './EscPosQrCodeEncoder';
import { formatTable, validateTableColumns } from '../../formatting';
import { CompileWarnings } from '../CompileWarnings';
import { EscPosFontMetrics } from './EscPosFontMetrics';

/** Tên ngôn ngữ trong câu cảnh báo. */
const ESC_POS_LANGUAGE_NAME = 'ESC/POS';

/** Giá trị "n" của ESC a n (căn lề). */
const ALIGN_LEFT = 0;
const ALIGN_CENTER = 1;
const ALIGN_RIGHT = 2;

/** Giá trị cờ bật/tắt dùng chung cho ESC E n / ESC - n / GS B n (bold, underline, reverse). */
const FEATURE_ON = 1;
const FEATURE_OFF = 0;

/** Độ dịch bit của nibble độ rộng trong `GS ! n` — nibble thấp là độ cao. */
const SIZE_WIDTH_NIBBLE_SHIFT = 4;

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

  const magnification = EscPosFontMetrics.fontSizeToMagnification(options.fontSize);
  if (magnification > 1) {
    // Mỗi nibble lưu (hệ số - 1); phóng đại đều 2 chiều để giữ tỉ lệ chữ.
    const nibble = magnification - 1;
    // eslint-disable-next-line no-bitwise
    const sizeByte = (nibble << SIZE_WIDTH_NIBBLE_SHIFT) | nibble;
    chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, sizeByte]));
  }

  if (options.reverse) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.REVERSE, FEATURE_ON]));

  chunks.push(encodeEscPosText(content, encoding));
  chunks.push(new Uint8Array([ESC_POS.LF]));

  if (options.bold) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.BOLD, FEATURE_OFF]));
  if (options.underline) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.UNDERLINE, FEATURE_OFF]));
  if (magnification > 1) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, FEATURE_OFF]));
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

function compileElement(
  element: PrintElement,
  encoding: TextEncodingOptions | undefined,
  warnings: CompileWarnings,
): Uint8Array[] {
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

    // ESC/POS không có lệnh vẽ vector nguyên sinh — bỏ qua và báo cảnh báo.
    case 'box':
    case 'line':
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      warnings.unsupportedElement(element.type);
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
  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): CompileResult<Uint8Array> {
    const chunks: Uint8Array[] = [new Uint8Array([ESC_POS.ESC, ESC_POS.INIT])];
    const warnings = new CompileWarnings(ESC_POS_LANGUAGE_NAME);

    for (const element of document.elements) {
      chunks.push(...compileElement(element, encoding, warnings));
    }

    return { output: concatEscPosBytes(chunks), warnings: warnings.toArray() };
  }
}

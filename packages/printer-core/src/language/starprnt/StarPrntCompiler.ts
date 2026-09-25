import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement, TextOptions } from '../../document/elements';
import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
import {
  STAR_PRNT,
  STAR_PRNT_ALIGN_VALUE,
  STAR_PRNT_CUT_VALUE,
  STAR_PRNT_DEFAULT_MAGNIFICATION,
  STAR_PRNT_UNDERLINE_VALUE,
  concatStarPrntBytes,
} from './StarPrntCommand';
import { encodeStarPrntImage } from './StarPrntEncoder';
import { formatTable, validateTableColumns } from '../../formatting';
import { CompileWarnings } from '../CompileWarnings';
import { StarPrntFontMetrics } from './StarPrntFontMetrics';

/** Tên ngôn ngữ trong câu cảnh báo. */
const STAR_PRNT_LANGUAGE_NAME = 'Star PRNT';

/** Cảnh báo khi `CutOptions.rows` bị bỏ qua. */
const CUT_ROWS_WARNING = 'CutOptions.rows bị bỏ qua — lệnh cắt ESC d của Star PRNT chỉ nhận 1 tham số cố định.';

/** Cảnh báo khi cắt một phần bị gộp thành cắt toàn phần. */
const CUT_PARTIAL_WARNING =
  'CutOptions.mode "partial" bị bỏ qua — compiler Star PRNT phát cùng 1 lệnh cắt cho "partial" và "full".';

function alignByte(align: TextOptions['align']): number {
  switch (align) {
    case 'center':
      return STAR_PRNT_ALIGN_VALUE.CENTER;
    case 'right':
      return STAR_PRNT_ALIGN_VALUE.RIGHT;
    default:
      return STAR_PRNT_ALIGN_VALUE.LEFT;
  }
}

function compileTextElement(content: string, options: TextOptions | undefined): Uint8Array[] {
  const resolvedOptions = options ?? {};
  const chunks: Uint8Array[] = [];

  chunks.push(new Uint8Array([STAR_PRNT.ESC, ...STAR_PRNT.ALIGN, alignByte(resolvedOptions.align)]));

  if (resolvedOptions.bold) chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.BOLD_ON]));
  if (resolvedOptions.underline) {
    chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.UNDERLINE, STAR_PRNT_UNDERLINE_VALUE.ON]));
  }

  const magnification = StarPrntFontMetrics.fontSizeToMagnification(resolvedOptions.fontSize);
  if (magnification > 1) {
    chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.SIZE, magnification, magnification]));
  }

  // Hạn chế: văn bản luôn xuất dưới dạng UTF-8 vì Star Line Mode ở đây chưa có
  // lệnh chọn code-page nào được xác nhận. Nội dung không phải ASCII phụ thuộc
  // vào việc máy in đã cấu hình sẵn UTF-8.
  chunks.push(new TextEncoder().encode(content));
  chunks.push(new Uint8Array([STAR_PRNT.LF]));

  if (resolvedOptions.bold) chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.BOLD_OFF]));
  if (resolvedOptions.underline) {
    chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.UNDERLINE, STAR_PRNT_UNDERLINE_VALUE.OFF]));
  }
  if (magnification > 1) {
    chunks.push(
      new Uint8Array([
        STAR_PRNT.ESC,
        STAR_PRNT.SIZE,
        STAR_PRNT_DEFAULT_MAGNIFICATION,
        STAR_PRNT_DEFAULT_MAGNIFICATION,
      ]),
    );
  }
  chunks.push(new Uint8Array([STAR_PRNT.ESC, ...STAR_PRNT.ALIGN, STAR_PRNT_ALIGN_VALUE.LEFT]));

  return chunks;
}

/**
 * ESC d n không có giá trị "full cut" riêng nào được xác nhận cho Star Line
 * Mode, nên 'partial' và 'full' đều dùng chung `STAR_PRNT_CUT_VALUE`. `rows`
 * bị bỏ qua vì ESC d chỉ nhận đúng 1 tham số cố định.
 */
function compileCutElement(
  element: Extract<PrintElement, { type: 'cut' }>,
  warnings: CompileWarnings,
): Uint8Array[] {
  const mode = element.options?.mode ?? 'full';
  if (mode === 'off') return [];

  if (element.options?.rows !== undefined) warnings.add(CUT_ROWS_WARNING);
  if (mode === 'partial') warnings.add(CUT_PARTIAL_WARNING);

  return [new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.CUT, STAR_PRNT_CUT_VALUE])];
}

function compileTableElement(element: Extract<PrintElement, { type: 'table' }>): Uint8Array[] {
  validateTableColumns(element.options.columns);
  const totalWidth = element.options.columns.reduce((sum, column) => sum + column.width, 0);
  const lines = formatTable(element.options.columns, element.options.rows, totalWidth);

  const chunks: Uint8Array[] = [];
  for (const line of lines) chunks.push(...compileTextElement(line, undefined));
  return chunks;
}

function compileElement(element: PrintElement, warnings: CompileWarnings): Uint8Array[] {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return [encodeStarPrntImage(element.bitmap)];

    case 'raw':
      return [typeof element.content === 'string' ? new TextEncoder().encode(element.content) : element.content];

    // Star Line Mode không có lệnh vẽ vector nào — bỏ qua và báo cảnh báo.
    case 'box':
    case 'line':
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      warnings.unsupportedElement(element.type);
      return [];

    // Star Line Mode không có nguyên hàm ngắt trang / tiến N dot / tự động bố
    // cục hàng-cột, và package chưa có engine bố cục tự động — no-op có chủ đích.
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return [];

    // Star Line Mode có định nghĩa lệnh barcode ("ESC b ...") và ký hiệu 2D
    // ("ESC GS y ..."), nhưng không có cấu trúc byte nào ở đây được xác thực
    // đủ để phát ra mà không phải đoán mò field — bỏ qua và báo cảnh báo.
    case 'barcode':
    case 'qrcode':
      warnings.unsupportedElement(element.type);
      return [];

    case 'cut':
      return compileCutElement(element, warnings);

    case 'table':
      return compileTableElement(element);
  }
}

/**
 * Cắt giấy hoàn toàn do các `CutElement` trong document điều khiển (không tự
 * động phát `ESC d 1` ở cuối) — nếu không, `CutOptions.mode: 'off'` sẽ không
 * thể thoả mãn và document tự đặt `cut` sẽ bị cắt 2 lần.
 *
 * `_encoding` chỉ để khớp chữ ký `PrintCompiler` chung, không được đọc — xem
 * `compileTextElement` (đầu ra văn bản luôn UTF-8).
 */
export class StarPrntCompiler implements PrintCompiler<Uint8Array> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<Uint8Array> {
    const chunks: Uint8Array[] = [new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.INIT])];
    const warnings = new CompileWarnings(STAR_PRNT_LANGUAGE_NAME);

    for (const element of document.elements) {
      chunks.push(...compileElement(element, warnings));
    }

    return { output: concatStarPrntBytes(chunks), warnings: warnings.toArray() };
  }
}

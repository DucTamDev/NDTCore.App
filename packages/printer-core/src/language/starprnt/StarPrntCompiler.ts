import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement, TextOptions } from '../../document/elements';
import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
import {
  BYTE_MASK,
  STAR_PRNT,
  STAR_PRNT_ALIGN_VALUE,
  STAR_PRNT_CUT_VALUE,
  STAR_PRNT_DEFAULT_MAGNIFICATION,
  STAR_PRNT_UNDERLINE_VALUE,
  concatStarPrntBytes,
} from './StarPrntCommand';
import { encodeStarPrntImage } from './StarPrntEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

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

  if (resolvedOptions.size !== undefined && resolvedOptions.size > 1) {
    // Kẹp hệ số phóng to về đúng 1 byte, theo định dạng lệnh "ESC i h w".
    // eslint-disable-next-line no-bitwise
    const magnification = resolvedOptions.size & BYTE_MASK;
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
  if (resolvedOptions.size !== undefined && resolvedOptions.size > 1) {
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
function compileCutElement(element: Extract<PrintElement, { type: 'cut' }>): Uint8Array[] {
  const mode = element.options?.mode ?? 'full';
  if (mode === 'off') return [];

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

function compileElement(element: PrintElement): Uint8Array[] {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return [encodeStarPrntImage(element.bitmap)];

    case 'raw':
      return [typeof element.content === 'string' ? new TextEncoder().encode(element.content) : element.content];

    // Star Line Mode không có lệnh vẽ vector nào; các loại này là no-op có chủ đích.
    case 'box':
    case 'line':
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
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
    // đủ để phát ra mà không phải đoán mò field. No-op có chủ đích, không phải bug.
    case 'barcode':
    case 'qrcode':
      return [];

    case 'cut':
      return compileCutElement(element);

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

    for (const element of document.elements) {
      chunks.push(...compileElement(element));
    }

    return { output: concatStarPrntBytes(chunks), warnings: [] };
  }
}

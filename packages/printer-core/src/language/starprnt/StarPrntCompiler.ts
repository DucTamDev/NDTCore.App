import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { TextOptions } from '../../document/elements/content/TextElement';
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

  // Hạn chế đã biết: văn bản luôn xuất ra dưới dạng UTF-8. Đầu ra Star PRNT ở
  // đây không nhận biết profile/code-page như đầu ra ESC/POS, vì package này
  // chưa có lệnh chọn code-page nào của Star Line Mode được xác nhận đáng tin
  // cậy để phát ra (`STAR_PRNT` không có hằng số nào như vậy, bản gốc được
  // port cũng không có). Vì vậy nội dung không phải ASCII phụ thuộc vào việc
  // máy in đã được cấu hình sẵn cho UTF-8.
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
 * Compiler Star PRNT của portakal chỉ phát đúng 1 chuỗi byte cắt giấy
 * (ESC d 1, luôn luôn, ở cuối mọi document) — không có giá trị byte
 * "full-cut" riêng nào có căn cứ trong nguồn đó, nên cả 'partial' lẫn
 * 'full' đều map về cùng 1 lệnh ở đây thay vì bịa ra 1 giá trị chưa xác
 * thực. `rows` cũng không có mã hoá nào có căn cứ (ESC d chỉ nhận đúng 1
 * tham số cố định) nên bị bỏ qua.
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

    // Star Line Mode không có lệnh vẽ vector gốc nào — box/line/diagonal/
    // circle/ellipse/reverse/erase đều là no-op, cùng khoảng trống này có ở
    // cả compiler Star PRNT lẫn ESC/POS của portakal.
    case 'box':
    case 'line':
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return [];

    // Không có nguyên hàm "ngắt trang" / "tiến N dot" / "tự động bố cục
    // hàng-cột", và package này cũng chưa có engine tự động bố cục — cùng
    // kiểu no-op đã ghi chú ở mọi compiler ngôn ngữ khác trong package.
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return [];

    // Nguồn Star PRNT của portakal không có biểu diễn barcode/QR nào cả —
    // union kiểu phần tử nội bộ của nó thậm chí không có các biến thể này
    // cho bất kỳ ngôn ngữ nào. Bộ lệnh Line Mode thật của Star có định nghĩa
    // 1 họ lệnh barcode ("ESC b ...") và 1 họ lệnh ký hiệu 2D ("ESC GS y
    // ..."), nhưng vì không có cấu trúc byte nào được xác thực, có căn cứ để
    // port ở đây (không như "GS k"/"GS ( k" của ESC/POS mà phía decode của
    // package này đã kiểm chứng), phát ra lệnh sẽ có nguy cơ tự bịa ra 1 bản
    // ghi trường cố định chưa được xác thực. No-op có chủ đích, không phải
    // bug.
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
 * Biên dịch một `ResolvedPrintDocument` thành bytes Star Line Mode.
 *
 * Khác với `compileToStarPRNT()` của portakal — nơi luôn luôn phát `ESC d 1`
 * đúng 1 lần ở cuối mọi document, bất kể nội dung — việc cắt giấy ở đây hoàn
 * toàn do các `CutElement` trong document điều khiển, cùng mô hình
 * element-driven mà mọi compiler ngôn ngữ khác trong package này dùng. Giữ
 * lại lệnh cắt cuối cùng vô điều kiện sẽ khiến `CutOptions.mode: 'off'`
 * không thể nào thoả mãn được, và sẽ cắt 2 lần với 1 document đã tự đặt sẵn
 * 1 element `cut` — nên nó không được port; xem case `'cut'` ở trên để biết
 * cái gì thay thế nó.
 *
 * `encoding` được chấp nhận để khớp chữ ký lời gọi với các compiler ngôn ngữ
 * khác nhưng không được đọc: xem `compileTextElement` để biết lý do đầu ra
 * văn bản Star PRNT chưa thể điều khiển theo encoding được.
 */
export class StarPrntCompiler implements PrintCompiler<Uint8Array> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): Uint8Array {
    const chunks: Uint8Array[] = [new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.INIT])];

    for (const element of document.elements) {
      chunks.push(...compileElement(element));
    }

    return concatStarPrntBytes(chunks);
  }
}

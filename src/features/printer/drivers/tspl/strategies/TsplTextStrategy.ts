import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { RenderMode } from '../../../models/printer/PrinterDriver';
import { PrinterErrorException, PrinterErrorCode } from '../../../errors/PrinterError';
import { TsplEncoder, contentWidthChars, columnOffsets } from '../TsplEncoder';
import { resolveEffectiveCutterMode } from '../../../paper/cutter';
import { formatRow } from '../../../utils/formatRow';
import { LINE_HEIGHT_DOTS, BARCODE_HEIGHT_DOTS, QRCODE_HEIGHT_DOTS } from '../../../rendering/printLayoutConstants';

/**
 * Text mode TSPL — dùng font built-in `"3"` mặc định của máy in, KHÔNG tải
 * font, KHÔNG đổi CODEPAGE. Trên nhiều dòng máy font này chỉ có glyph ASCII
 * (xem comment `TsplEncoder.text()`) — chấp nhận giới hạn này, khác với
 * `TrueType`/`InternalFont` cũ (đã xoá) vốn cố sửa vấn đề này và có rủi ro
 * riêng. Không tự wrap dòng dài (spec §6) — mirror mức đơn giản của
 * `buildEscPosText` (ESC/POS Encoder).
 */
export class TsplTextStrategy implements ITsplPrintStrategy {
  readonly mode = RenderMode.Encoder;

  validate(_context: TsplStrategyContext): void {
    // Không có precondition — không cần ảnh như TsplBitmapStrategy.
  }

  encode(context: TsplStrategyContext): Uint8Array {
    const { documents, paper, printType, rows } = context;
    const encoder = new TsplEncoder().initialize(paper, printType);
    const charsPerLine = contentWidthChars(paper);

    // Die-cut nhiều cột (`columnOffsets` trả `[0]` cho giấy continuous, nên
    // vòng lặp ngoài là no-op với Receipt) — lặp lại TOÀN BỘ nội dung ở mỗi
    // x-offset cột, giống `TsplBitmapStrategy.encode()` lặp `encoder.image()`
    // theo `columnOffsets`. Thiếu vòng lặp này thì Text mode chỉ in được cột
    // đầu trên tem die-cut nhiều cột, trong khi Bitmap mode in đủ mọi cột.
    for (const dx of columnOffsets(paper)) {
      let y = 0;

      for (const element of documents.text.elements) {
        switch (element.type) {
          case 'text':
            encoder.text(dx, y, element.content);
            y += LINE_HEIGHT_DOTS;
            break;
          case 'line':
            encoder.text(dx, y, '-'.repeat(charsPerLine));
            y += LINE_HEIGHT_DOTS;
            break;
          case 'row':
            encoder.text(dx, y, formatRow(element.left, element.right, charsPerLine));
            y += LINE_HEIGHT_DOTS;
            break;
          case 'table':
            for (const row of element.rows) {
              encoder.text(dx, y, row.join('  '));
              y += LINE_HEIGHT_DOTS;
            }
            break;
          case 'barcode':
            encoder.barcode(dx, y, element.content);
            y += BARCODE_HEIGHT_DOTS;
            break;
          case 'qrCode':
            encoder.qrcode(dx, y, element.content);
            y += QRCODE_HEIGHT_DOTS;
            break;
          case 'image':
            throw new PrinterErrorException({
              code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED,
              message: 'TSPL text mode không hỗ trợ phần tử image — dùng chế độ Bitmap.',
            });
        }
      }
    }

    return encoder.cut(rows, resolveEffectiveCutterMode(paper)).encode();
  }
}

import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { PrinterDriverType, TsplRenderMode } from '../../../types/printer.types';
import { PrinterErrorException, PrinterErrorCode } from '../../../errors/PrinterError';
import { TsplEncoder, columnOffsets, contentWidthChars } from '../TsplEncoder';
import { resolveEffectiveCutterMode } from '../../../media/cutter';
import { formatRow } from '../../../utils/formatRow';

/**
 * `documents.text` → lệnh `TEXT`/`BARCODE`/`QRCODE` dùng font NỘI BỘ của máy in
 * (`config.internalFont.fontName`) với `CODEPAGE config.internalFont.codepage`.
 * KHÔNG bitmap, KHÔNG `DOWNLOAD` font, KHÔNG fallback.
 *
 * `validate()` chỉ kiểm tra CONFIGURATION invariant — không dò firmware máy in
 * có thật sự hỗ trợ codepage/font đó hay không (không có cách software nào
 * verify, tương tự `truetype`). Nếu firmware không hỗ trợ, kết quả in ra sai
 * dấu — người dùng tự chuyển về `bitmap`.
 */
export class TsplInternalFontStrategy implements ITsplPrintStrategy {
  readonly mode = TsplRenderMode.internalfont;

  validate(context: TsplStrategyContext): void {
    const { config } = context.driver;
    if (config.type !== PrinterDriverType.tspl || config.renderMode !== TsplRenderMode.internalfont || !config.internalFont) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED,
        message: 'Chưa cấu hình font máy in (codepage / tên font) cho chế độ "Font máy in".',
      });
    }
  }

  encode(context: TsplStrategyContext): Uint8Array {
    const { driver, documents, printType, media, rows } = context;
    if (driver.config.type !== PrinterDriverType.tspl || !driver.config.internalFont) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED,
        message: 'Thiếu cấu hình font máy in.',
      });
    }
    const { fontName, codepage } = driver.config.internalFont;
    const paperWidth = contentWidthChars(media);
    const encoder = new TsplEncoder().initialize(media, printType, codepage);
    for (const dx of columnOffsets(media)) {
      for (const element of documents.text.elements) {
        if (element.type === 'text') {
          encoder.text(element.x + dx, element.y, element.content, fontName);
        } else if (element.type === 'line') {
          encoder.text(element.x + dx, element.y, '-'.repeat(paperWidth), fontName);
        } else if (element.type === 'table') {
          element.rows.forEach((row, i) => encoder.text(element.x + dx, element.y + i * 20, row.join('  '), fontName));
        } else if (element.type === 'row') {
          encoder.text(element.x + dx, element.y, formatRow(element.left, element.right, paperWidth), fontName);
        } else if (element.type === 'barcode') {
          encoder.barcode(element.x + dx, element.y, element.content);
        } else if (element.type === 'qrCode') {
          encoder.qrcode(element.x + dx, element.y, element.content);
        } else {
          throw new PrinterErrorException({
            code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED,
            message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}`,
          });
        }
      }
    }
    return encoder.cut(rows, resolveEffectiveCutterMode(media)).encode();
  }
}

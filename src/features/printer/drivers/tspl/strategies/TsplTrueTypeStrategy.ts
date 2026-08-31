import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { PrinterDriverType, TsplRenderMode } from '../../../types/printer.types';
import { PrinterErrorException, PrinterErrorCode } from '../../../types/PrinterError';
import { TsplEncoder, columnOffsets, contentWidthChars } from '../TsplEncoder';
import { resolveEffectiveCutterMode } from '../../../utils/cutter';
import { formatRow } from '../../../utils/formatRow';

/**
 * `documents.text` → lệnh `TEXT`/`BARCODE`/`QRCODE` dùng font custom đã
 * `DOWNLOAD` (`config.font.name`), theo sau `PRINT` (§39-42). KHÔNG đọc
 * `documents.image`, KHÔNG gửi font binary, KHÔNG fallback.
 *
 * `validate()` chỉ kiểm tra CONFIGURATION invariant đã resolve vào
 * `driver.config` — không phải runtime font detection (spec §12).
 */
export class TsplTrueTypeStrategy implements ITsplPrintStrategy {
  readonly mode = TsplRenderMode.truetype;

  validate(context: TsplStrategyContext): void {
    const { config } = context.driver;
    if (config.type !== PrinterDriverType.tspl || config.renderMode !== TsplRenderMode.truetype || !config.font?.fontInstalled) {
      throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_FONT_NOT_INSTALLED, message: 'Chưa cài font TrueType cho máy in này — bật lại công tắc "In bằng font TrueType" để cài.' });
    }
  }

  encode(context: TsplStrategyContext): Uint8Array {
    const { driver, documents, printType, media, rows } = context;
    if (driver.config.type !== PrinterDriverType.tspl || !driver.config.font) {
      throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_FONT_NOT_INSTALLED, message: 'Thiếu cấu hình font TrueType.' });
    }
    const fontName = driver.config.font.name;
    const paperWidth = contentWidthChars(media);
    const encoder = new TsplEncoder().initialize(media, printType);
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
          throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
        }
      }
    }
    return encoder.cut(rows, resolveEffectiveCutterMode(media)).encode();
  }
}

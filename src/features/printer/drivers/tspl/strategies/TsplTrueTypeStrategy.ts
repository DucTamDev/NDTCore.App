import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { PrinterDriverType, TsplRenderMode } from '../../../types/printer.types';
import { AppErrorException, AppErrorCode } from '../../../types/AppError';
import { TsplEncoder } from '../TsplEncoder';
import { PAPER_WIDTH_CHARS, formatRow } from '../../../utils/paperWidth';

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
      throw new AppErrorException({ code: AppErrorCode.TSPL_FONT_NOT_INSTALLED, message: 'Chưa cài font TrueType cho máy in này — bật lại công tắc "In bằng font TrueType" để cài.' });
    }
  }

  encode(context: TsplStrategyContext): Uint8Array {
    const { printer, driver, documents, printType, heightMm } = context;
    if (driver.config.type !== PrinterDriverType.tspl || !driver.config.font) {
      throw new AppErrorException({ code: AppErrorCode.TSPL_FONT_NOT_INSTALLED, message: 'Thiếu cấu hình font TrueType.' });
    }
    const fontName = driver.config.font.name;
    const paperWidth = PAPER_WIDTH_CHARS[printer.paperSize];
    const encoder = new TsplEncoder().initialize(printer.paperSize, printType, heightMm);
    for (const element of documents.text.elements) {
      if (element.type === 'text') {
        encoder.text(element.x, element.y, element.content, fontName);
      } else if (element.type === 'line') {
        encoder.text(element.x, element.y, '-'.repeat(paperWidth), fontName);
      } else if (element.type === 'table') {
        element.rows.forEach((row, i) => encoder.text(element.x, element.y + i * 20, row.join('  '), fontName));
      } else if (element.type === 'row') {
        encoder.text(element.x, element.y, formatRow(element.left, element.right, paperWidth), fontName);
      } else if (element.type === 'barcode') {
        encoder.barcode(element.x, element.y, element.content);
      } else if (element.type === 'qrCode') {
        encoder.qrcode(element.x, element.y, element.content);
      } else {
        throw new AppErrorException({ code: AppErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
      }
    }
    return encoder.cut().encode();
  }
}

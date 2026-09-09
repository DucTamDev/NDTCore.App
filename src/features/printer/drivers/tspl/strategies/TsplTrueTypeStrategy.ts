import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { PrinterDriverType, PrintRenderMode } from '../../../models/printer/PrinterDriver';
import { PrinterErrorException, PrinterErrorCode } from '../../../errors/PrinterError';
import { TsplEncoder, columnOffsets, contentWidthChars } from '../TsplEncoder';
import { resolveEffectiveCutterMode } from '../../../paper/cutter';
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
  readonly mode = PrintRenderMode.truetype;

  validate(context: TsplStrategyContext): void {
    const { config } = context.driver;

    if (config.type !== PrinterDriverType.tspl || config.renderMode !== PrintRenderMode.truetype || !config.font?.fontInstalled) {
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
        switch (element.type) {
          case 'text':
            encoder.text(element.x + dx, element.y, element.content, fontName);
            break;
          case 'line':
            encoder.text(element.x + dx, element.y, '-'.repeat(paperWidth), fontName);
            break;
          case 'table':
            element.rows.forEach((row, i) => encoder.text(element.x + dx, element.y + i * 20, row.join('  '), fontName));
            break;
          case 'row':
            encoder.text(element.x + dx, element.y, formatRow(element.left, element.right, paperWidth), fontName);
            break;
          case 'barcode':
            encoder.barcode(element.x + dx, element.y, element.content);
            break;
          case 'qrCode':
            encoder.qrcode(element.x + dx, element.y, element.content);
            break;
          default:
            throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
        }
      }
    }

    return encoder.cut(rows, resolveEffectiveCutterMode(media)).encode();
  }
}

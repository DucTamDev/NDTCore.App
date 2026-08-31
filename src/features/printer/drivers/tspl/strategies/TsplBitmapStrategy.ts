import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { TsplRenderMode } from '../../../types/printer.types';
import { PrintMediaType } from '../../../models/media/PrintMedia';
import { PrinterErrorException, PrinterErrorCode } from '../../../errors/PrinterError';
import { TsplEncoder, DOTS_PER_MM, resolveSizeHeightMm, columnOffsets } from '../TsplEncoder';
import { resolveEffectiveCutterMode } from '../../../media/cutter';
import { PAPER_SIZE_SPECS } from '../../../media/paperSpec';
import { decodePngBase64ToMonochrome } from '../../../utils/pngToMonochrome';

/**
 * `documents.image` (base64 PNG) → monochrome 1-bit → lệnh `BITMAP` (§31-38).
 * KHÔNG fallback: thiếu ảnh / ảnh hỏng / ảnh quá cao đều là hard failure.
 */
export class TsplBitmapStrategy implements ITsplPrintStrategy {
  readonly mode = TsplRenderMode.bitmap;

  validate(context: TsplStrategyContext): void {
    if (!context.documents.image) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.TSPL_IMAGE_REQUIRED,
        message: 'Chế độ Bitmap cần ảnh bill đã render — capture ảnh thất bại hoặc chưa chạy.',
      });
    }
  }

  encode(context: TsplStrategyContext): Uint8Array {
    const { printType, media, rows, documents } = context;
    const heightMm = resolveSizeHeightMm(media, printType);
    const paperSize = media.paperSize;
    const targetWidthPx = media.type === PrintMediaType.dieCut
      ? (media.itemWidthMm ?? 0) * DOTS_PER_MM
      : PAPER_SIZE_SPECS[paperSize].imageWidthPx;
    let bitmap;
    try {
      bitmap = decodePngBase64ToMonochrome(documents.image as string, targetWidthPx);
    } catch (error) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.TSPL_IMAGE_INVALID,
        message: 'Ảnh bill không hợp lệ (không giải mã được PNG).',
        cause: error,
      });
    }
    const maxHeightPx = heightMm * DOTS_PER_MM;
    if (bitmap.heightPx > maxHeightPx) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.TSPL_IMAGE_TOO_LARGE,
        message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — dùng giấy dài hơn hoặc rút gọn nội dung.`,
      });
    }
    const encoder = new TsplEncoder().initialize(media, printType);
    for (const dx of columnOffsets(media)) encoder.image(dx, 0, bitmap);
    return encoder.cut(rows, resolveEffectiveCutterMode(media)).encode();
  }
}

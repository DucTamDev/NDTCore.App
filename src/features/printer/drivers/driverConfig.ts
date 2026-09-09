import { EscPosRenderMode, PrinterDriverType, TsplRenderMode } from '../models/printer/PrinterDriver';
import type { PrinterDriver, TsplInternalFontConfig } from '../models/printer/PrinterDriver';
import type { PaperSize, PrintPaperConfig } from '../models/paper/PrintPaperConfig';

/**
 * `renderMode` đã cấu hình của driver TSPL — chỉ là ý định khai báo, không quan
 * tâm font đã cài xong chưa. (Kiến trúc Strategy không-fallback: "cấu hình
 * truetype nhưng chưa sẵn sàng" là lỗi in do strategy ném ra, không phải trạng
 * thái để tầng gọi tự đoán và né.) `null` nếu driver không phải TSPL.
 */
export const tsplRenderModeOf = (driver: PrinterDriver): TsplRenderMode | null =>
  driver.config.type === PrinterDriverType.tspl ? driver.config.renderMode : null;

export const mediaOf = (driver: PrinterDriver): PrintPaperConfig => driver.config.media;

export const paperSizeOf = (driver: PrinterDriver): PaperSize => driver.config.media.paperSize;

/**
 * `renderMode` đã cấu hình của driver ESC/POS — `undefined` coi như `'text'`
 * (giữ tương thích ngược printer đã lưu trước khi field này tồn tại). `null`
 * nếu driver không phải ESC/POS.
 */
export const escPosRenderModeOf = (driver: PrinterDriver): EscPosRenderMode | null =>
  driver.config.type === PrinterDriverType.escpos ? (driver.config.renderMode ?? EscPosRenderMode.text) : null;

/** Driver này có đang ở chế độ render ảnh không — dùng chung cho mọi protocol có khái niệm bitmap. */
export const usesBitmapRenderMode = (driver: PrinterDriver): boolean => {
  if (driver.type === PrinterDriverType.tspl) {
    return tsplRenderModeOf(driver) === TsplRenderMode.bitmap;
  }

  if (driver.type === PrinterDriverType.escpos) {
    return escPosRenderModeOf(driver) === EscPosRenderMode.bitmap;
  }

  return false;
};

/** `internalFont` mặc định khi lần đầu chọn "Font máy in" — CP1258 + font bitmap `'3'`. */
export const DEFAULT_TSPL_INTERNAL_FONT: TsplInternalFontConfig = { codepage: '1258', fontName: '3' };

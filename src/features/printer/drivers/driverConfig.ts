import { PrinterDriverType } from '../models/printer/PrinterDriver';
import type { PrinterDriver, TsplInternalFontConfig, TsplRenderMode } from '../models/printer/PrinterDriver';
import type { PaperSize, PrintMedia } from '../models/media/PrintMedia';

/**
 * `renderMode` đã cấu hình của driver TSPL — chỉ là ý định khai báo, không quan
 * tâm font đã cài xong chưa. (Kiến trúc Strategy không-fallback: "cấu hình
 * truetype nhưng chưa sẵn sàng" là lỗi in do strategy ném ra, không phải trạng
 * thái để tầng gọi tự đoán và né.) `null` nếu driver không phải TSPL.
 */
export const tsplRenderModeOf = (driver: PrinterDriver): TsplRenderMode | null =>
  driver.config.type === PrinterDriverType.tspl ? driver.config.renderMode : null;

export const mediaOf = (driver: PrinterDriver): PrintMedia => driver.config.media;

export const paperSizeOf = (driver: PrinterDriver): PaperSize => driver.config.media.paperSize;

/** `internalFont` mặc định khi lần đầu chọn "Font máy in" — CP1258 + font bitmap `'3'`. */
export const DEFAULT_TSPL_INTERNAL_FONT: TsplInternalFontConfig = { codepage: '1258', fontName: '3' };

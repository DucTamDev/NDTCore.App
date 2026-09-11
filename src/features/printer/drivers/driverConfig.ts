import { RenderMode } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import { PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';

/** Cấu hình giấy mặc định khi tạo 1 `Printer` mới — 80mm, cuộn liên tục. */
export const DEFAULT_PAPER: PrintPaperConfig = { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 };

/** Driver này có đang ở chế độ render ảnh không — dùng chung cho cả 2 protocol vì `PrinterDriverConfig` giờ dùng chung 1 shape. */
export const usesBitmapRenderMode = (driver: PrinterDriver): boolean => driver.config.renderMode === RenderMode.Bitmap;

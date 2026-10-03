import { RenderMode } from '../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';
import { PaperSize, PaperType } from '../models/paper/PaperOptions';
import type { PaperOptions } from '../models/paper/PaperOptions';

/** Cấu hình giấy mặc định khi tạo 1 `Printer` mới — 80mm, cuộn liên tục. */
export const DEFAULT_PAPER: PaperOptions = { type: PaperType.Continuous, paperSize: PaperSize.Mm80 };

/** Máy in có đang in ảnh không. */
export const usesRasterRenderMode = (language: PrinterLanguage): boolean => language.renderMode === RenderMode.Raster;

import { PrintRenderMode, PrinterDriverType, type PrinterDriverConfig } from '../models/printer/PrinterDriver';
import { PrintType } from '../models/printing/PrintType';
import { PrintPaperType } from '../models/paper/PrintPaperConfig';

const DEFAULT_MEDIA = { type: PrintPaperType.continuous, paperSize: 80 } as const;

export interface DriverCapabilities {
  contentTypes: PrintType[];
  /** Config khởi tạo khi thêm 1 driver mới loại này — nguồn sự thật duy nhất, không viết tay rải rác ở nơi gọi. */
  defaultConfig: PrinterDriverConfig;
}

/**
 * Capability TĨNH theo driver TYPE — driver này CÓ THỂ in loại nội dung nào,
 * tách biệt hoàn toàn khỏi `PrinterDriver.contentTypes` (loại nội dung THỰC
 * TẾ đang được gán cho 1 driver cụ thể của 1 printer, xem `models/printer/PrinterDriver.ts`).
 * KHÔNG phải rule table theo vendor/model — cơ chế đó đã bị bỏ trước đây vì
 * không đáng tin (xem CLAUDE.md).
 */
export const DRIVER_CAPABILITIES: Record<PrinterDriverType, DriverCapabilities> = {
  escpos: { contentTypes: [PrintType.Receipt], defaultConfig: { type: PrinterDriverType.escpos, renderMode: PrintRenderMode.encoder, media: { ...DEFAULT_MEDIA } } },
  tspl: { contentTypes: [PrintType.Receipt, PrintType.Label], defaultConfig: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, media: { ...DEFAULT_MEDIA } } },
};

export const getDriverCapabilities = (type: PrinterDriverType): DriverCapabilities => DRIVER_CAPABILITIES[type];

import { PrinterDriverType, TsplRenderMode, type PrinterDriverConfig } from '../types/printer.types';
import { PrintType } from '../types/printConfiguration.types';

export interface PrinterDriverDefinition {
  contentTypes: PrintType[];
  /** Config khởi tạo khi thêm 1 driver mới loại này — nguồn sự thật duy nhất, không viết tay rải rác ở nơi gọi. */
  defaultConfig: PrinterDriverConfig;
}

/**
 * Capability TĨNH theo driver TYPE — driver này CÓ THỂ in loại nội dung nào,
 * tách biệt hoàn toàn khỏi `PrinterDriver.contentTypes` (loại nội dung THỰC
 * TẾ đang được gán cho 1 driver cụ thể của 1 printer, xem `types/printer.types.ts`).
 * KHÔNG phải rule table theo vendor/model — cơ chế đó đã bị bỏ trước đây vì
 * không đáng tin (xem CLAUDE.md).
 */
export const PRINTER_DRIVER_DEFINITIONS: Record<PrinterDriverType, PrinterDriverDefinition> = {
  escpos: { contentTypes: [PrintType.Receipt], defaultConfig: { type: PrinterDriverType.escpos } },
  tspl: { contentTypes: [PrintType.Receipt, PrintType.Label], defaultConfig: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap } },
};

export const getDriverDefinition = (type: PrinterDriverType): PrinterDriverDefinition => PRINTER_DRIVER_DEFINITIONS[type];

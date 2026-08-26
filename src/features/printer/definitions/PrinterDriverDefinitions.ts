import type { PrinterDriverType } from '../types/printer.types';
import type { PrintType } from '../types/printConfiguration.types';

export interface PrinterDriverDefinition {
  contentTypes: PrintType[];
}

/**
 * Capability TĨNH theo driver TYPE — driver này CÓ THỂ in loại nội dung nào,
 * tách biệt hoàn toàn khỏi `PrinterDriver.contentTypes` (loại nội dung THỰC
 * TẾ đang được gán cho 1 driver cụ thể của 1 printer, xem `types/printer.types.ts`).
 * KHÔNG phải rule table theo vendor/model — cơ chế đó đã bị bỏ trước đây vì
 * không đáng tin (xem CLAUDE.md).
 */
export const PRINTER_DRIVER_DEFINITIONS: Record<PrinterDriverType, PrinterDriverDefinition> = {
  escpos: { contentTypes: ['Receipt'] },
  tspl: { contentTypes: ['Receipt', 'Label'] },
};

export const getDriverDefinition = (type: PrinterDriverType): PrinterDriverDefinition => PRINTER_DRIVER_DEFINITIONS[type];

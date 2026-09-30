import { RenderMode, PrinterDriverType, type PrinterDriverConfig } from '../models/printer/PrinterDriver';
import { PrintType } from '../models/printing/PrintType';

export interface DriverCapabilities {
  contentTypes: PrintType[];
  /** Config khởi tạo khi tạo 1 `Printer` mới với driver loại này — nguồn sự thật duy nhất, không viết tay rải rác ở nơi gọi. */
  defaultConfig: PrinterDriverConfig;
}

/**
 * Capability TĨNH theo driver TYPE — driver loại này CÓ THỂ phục vụ loại nội
 * dung nào (dùng để lọc candidate lúc discovery theo `printType` đang mở, xem
 * `PrinterDiscoveryService.ts`). KHÔNG phải rule table theo vendor/model.
 */
export const DRIVER_CAPABILITIES: Record<PrinterDriverType, DriverCapabilities> = {
  [PrinterDriverType.EscPos]: { contentTypes: [PrintType.Receipt], defaultConfig: { renderMode: RenderMode.Encoder } },
  [PrinterDriverType.Tspl]: { contentTypes: [PrintType.Receipt, PrintType.Label], defaultConfig: { renderMode: RenderMode.Bitmap } },
};

export const getDriverCapabilities = (type: PrinterDriverType): DriverCapabilities => DRIVER_CAPABILITIES[type];

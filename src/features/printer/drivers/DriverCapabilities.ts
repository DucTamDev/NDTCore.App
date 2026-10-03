import { RenderMode, PrintLanguage, type PrinterLanguage } from '../models/printer/PrinterLanguage';
import { PrintKind } from '../models/printer/PrintKind';

export interface DriverCapabilities {
  contentTypes: PrintKind[];
  /** Config khởi tạo khi tạo 1 `Printer` mới với driver loại này — nguồn sự thật duy nhất, không viết tay rải rác ở nơi gọi. */
  defaultConfig: Pick<PrinterLanguage, 'renderMode'>;
}

/**
 * Capability TĨNH theo driver TYPE — driver loại này CÓ THỂ phục vụ loại nội
 * dung nào (dùng để lọc candidate lúc discovery theo `kind` đang mở, xem
 * `PrinterDiscoveryService.ts`). KHÔNG phải rule table theo vendor/model.
 */
export const DRIVER_CAPABILITIES: Record<PrintLanguage, DriverCapabilities> = {
  [PrintLanguage.EscPos]: { contentTypes: [PrintKind.Receipt], defaultConfig: { renderMode: RenderMode.Command } },
  [PrintLanguage.Tspl]: { contentTypes: [PrintKind.Receipt, PrintKind.Label], defaultConfig: { renderMode: RenderMode.Raster } },
};

export const getDriverCapabilities = (type: PrintLanguage): DriverCapabilities => DRIVER_CAPABILITIES[type];

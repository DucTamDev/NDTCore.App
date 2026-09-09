import type { PrinterDriver } from './PrinterDriver';
import type { PrinterCapabilities } from './PrinterCapabilities';
import type { PrinterConnection } from './PrinterConnection';

/**
 * 1 máy in đã được user thêm và LƯU vào storage — đây là bản ghi đầy đủ, khác
 * với `PrinterDevice` (models/printer/PrinterDevice.ts) là kết quả scan tạm
 * thời trước khi user chọn/lưu. `connection` chứa thông tin kết nối THẬT sự
 * đã ghi (không phải kết quả scan).
 */
export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  /** `1..2` phần tử (escpos + tspl) — enforce ở schema. */
  drivers: PrinterDriver[];
  /** Thông tin kết nối đã lưu — xem `PrinterConnection` cho vòng đời 3 giai đoạn (scan → connection → identify). */
  connection: PrinterConnection;
  /** Chỉ phụ thuộc connection, không phụ thuộc driver — xem `discovery/PrinterResolver.ts`. */
  identityKey: string;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

import type { PrinterDriver } from './PrinterDriver';
import type { PrinterCapabilities } from './PrinterCapabilities';
import type { PrinterConnection } from './PrinterConnection';
import type { PrintPaperConfig } from '../paper/PrintPaperConfig';
import type { PrintType } from '../printing/PrintType';

/**
 * 1 cấu hình in đã lưu — ĐÚNG 1 connection + ĐÚNG 1 driver + ĐÚNG 1 loại nội
 * dung (`type`) + ĐÚNG 1 cấu hình giấy. Khác `PrinterDevice` (PrinterDevice.ts)
 * là kết quả scan tạm thời trước khi lưu. Cùng 1 máy in vật lý phục vụ cả Hoá
 * đơn lẫn Tem thì có 2 `Printer` riêng, có thể cùng `connection` khác `driver`
 * (xem ARCHITECTURE.md).
 */
export interface Printer {
  id: string;
  /** Chỉ phụ thuộc connection, không phụ thuộc driver — xem `discovery/PrinterResolver.ts`. Ràng buộc unique là cặp `(identityKey, type)`, không phải `identityKey` một mình — xem `storage/PrinterRepository.ts`. */
  identityKey: string;
  type: PrintType;
  name: string;
  vendor?: string;
  model?: string;
  connection: PrinterConnection;
  driver: PrinterDriver;
  paper: PrintPaperConfig;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

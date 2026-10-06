import type { PrinterConnection } from '../printer/PrinterConnection';
import type { DeviceInfo } from '../device/DeviceInfo';

/** Một kết quả quét: thiết bị và cách kết nối tới nó. */
export interface DiscoverResult {
  device: DeviceInfo;

  /** Chọn máy thì gán thẳng vào `Printer.connection`. */
  connection: PrinterConnection;
}

import type { PrinterConnection } from '../printer/PrinterConnection';
import type { DeviceInfo } from './DeviceInfo';

/** Một kết quả quét: thiết bị và cách kết nối tới nó. */
export interface DiscoveredDevice {
  device: DeviceInfo;

  /** Chọn máy thì gán thẳng vào `Printer.connection`. */
  connection: PrinterConnection;
}

import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from './printer.types';
import type { PrintDocument } from './printDocument.types';
import type { PrintType } from './printConfiguration.types';

export type Unsubscribe = () => void;

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(config: PrinterConfig): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  /**
   * `printType` cho driver biết đang in Hoá đơn hay Tem — chỉ `TsplDriver`
   * dùng tới (chọn chế độ giấy liên tục hay dò khe, xem `TsplEncoder.initialize()`),
   * driver khác (`ThermalReceiptDriver`) bỏ qua. Optional vì không phải mọi
   * nơi gọi đều có sẵn thông tin này (vd `identify()`-only flow).
   */
  testPrint(config: PrinterConfig, document: PrintDocument, printType?: PrintType): Promise<void>;
  print(printerId: string, document: PrintDocument, printType?: PrintType): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
}

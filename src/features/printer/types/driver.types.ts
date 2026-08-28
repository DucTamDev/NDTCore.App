import type { ConnectionType, DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver, PrinterStatus } from './printer.types';
import type { PrintDocument } from './printDocument.types';
import type { PrintType } from './printConfiguration.types';

export type Unsubscribe = () => void;

/**
 * `text` là document dùng mặc định cho mọi driver. `image` (tuỳ chọn) là bản
 * base64 PNG render sẵn — driver TỰ quyết định có dùng hay không (xem
 * `encode()` bên dưới và spec §7.2), KHÔNG phải nơi gọi (`PrintRoutingService`/
 * `PrintService`) quyết định thay.
 */
export interface PrintDocuments {
  text: PrintDocument;
  /** Base64 PNG (không tiền tố `data:`) — nguồn cho TSPL bitmap. */
  image?: string;
}

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(printer: Printer, driver: PrinterDriver): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType?: PrintType): Promise<void>;
  print(printerId: string, documents: PrintDocuments, printType?: PrintType): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
  /**
   * Mã hoá `documents` (chọn variant text/image theo capability của chính
   * driver) + `driver.config` thành raw bytes — public pure, dùng cho unit
   * test/snapshot không cần transport/printer thật (spec §7.2). Với ESC/POS,
   * hàm này CHỈ phục vụ test — production print đi qua thư viện vendor gộp
   * sẵn (adapters/ThermalPrinterLibraryAdapter.ts), không gọi `encode()`.
   */
  encode(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType?: PrintType): Uint8Array;
}

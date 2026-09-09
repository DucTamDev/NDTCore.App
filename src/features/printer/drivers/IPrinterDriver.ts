import type { ConnectionType, DeviceScanEvent, PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { Printer } from '../models/printer/Printer';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import type { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrintDocument } from '../models/printing/PrintDocument';
import type { PrintType } from '../models/printing/PrintType';

export type Unsubscribe = () => void;

/**
 * `text` là document dùng mặc định cho mọi driver. `image` (tuỳ chọn) là bản
 * base64 PNG render sẵn — driver TỰ quyết định có dùng hay không, KHÔNG phải
 * nơi gọi (`PrintRoutingService`/`PrintService`) quyết định thay.
 */
export interface PrintDocuments {
  text: PrintDocument;
  /** Base64 PNG (không tiền tố `data:`) — nguồn cho TSPL bitmap. */
  image?: string;
}

/** Tuỳ chọn in bổ sung, không phụ thuộc protocol — chỉ TSPL đọc `rows` (die-cut). */
export interface PrintOptions {
  /** Số HÀNG die-cut cần in (mỗi hàng = `media.columns` con tem). Default 1. Bỏ qua khi media continuous ở đường routing; `testPrint` dùng để in thử grid. */
  rows?: number;
}

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(printer: Printer, driver: PrinterDriver): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
  print(printerId: string, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
}

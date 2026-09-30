import type { PrinterConnectionType } from '../models/printer/PrinterConnection';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { Printer } from '../models/printer/Printer';
import type { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrintDocument } from '../models/printing/PrintDocument';

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
  /** Số HÀNG die-cut cần in (mỗi hàng = `paper.columns` con tem). Default 1. Bỏ qua khi paper continuous ở đường routing; `testPrint` dùng để in thử grid. */
  rows?: number;
}

/** `printer.driver`/`printer.type`/`printer.paper` đã đủ context — không còn tham số `driver`/`printType` rời như bản cũ (mỗi `Printer` giờ chỉ có 1 driver). */
export interface IPrinterDriver {
  scan(connectionType: PrinterConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(printer: Printer): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void>;
  print(printerId: string, documents: PrintDocuments, options?: PrintOptions): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
}

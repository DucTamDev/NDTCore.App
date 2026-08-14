import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from './printer.types';
import type { PrintDocument } from './printDocument.types';

export type Unsubscribe = () => void;

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(config: PrinterConfig): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(config: PrinterConfig): Promise<void>;
  print(printerId: string, document: PrintDocument): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
}

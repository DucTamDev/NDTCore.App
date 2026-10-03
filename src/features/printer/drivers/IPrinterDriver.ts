import type { Unsubscribe } from '../adapters/IPrinterAdapter';
import type { ConnectionType } from '../models/printer/ConnectionType';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { Printer } from '../models/printer/Printer';

export type { Unsubscribe };

/** Quét thiết bị và xác nhận ngôn ngữ của một máy in đã kết nối qua `PrinterConnectionService`. */
export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;

  /** `null` khi không xác nhận được máy in nói ngôn ngữ này. */
  identify(printer: Printer): Promise<PrinterDeviceInfo | null>;
}

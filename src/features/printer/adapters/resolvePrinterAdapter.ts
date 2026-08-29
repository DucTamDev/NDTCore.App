import type { IPrinterAdapter } from './IPrinterAdapter';
import { ConnectionType, PrinterDriverType } from '../types/printer.types';
import { NativeAdapter } from './native/NativeAdapter';
import { LibraryAdapter } from './library/LibraryAdapter';

/**
 * Chọn `IPrinterAdapter` theo driver + connectionType:
 * - **ESC/POS**: luôn `NativeAdapter` — `printText` encode ở JS, không cần `read`.
 * - **TSPL / USB**: `NativeAdapter` — ghi byte thô qua `RNUSBPrinter` (USB không đọc được, `identify` vẫn `null`).
 * - **TSPL / BLE-LAN**: `LibraryAdapter` — `tcp-socket`/`bluetooth-classic` đọc được phản hồi (cần cho `identify` `~!T`).
 */
export const resolvePrinterAdapter = (
  driverType: PrinterDriverType,
  connectionType: ConnectionType,
): IPrinterAdapter => {
  if (driverType === PrinterDriverType.escpos) return new NativeAdapter();
  if (connectionType === ConnectionType.usb) return new NativeAdapter();
  return new LibraryAdapter();
};

import type { IPrinterAdapter } from './IPrinterAdapter';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { NativeAdapter } from './native/NativeAdapter';
import { LibraryAdapter } from './library/LibraryAdapter';

/**
 * Chọn `IPrinterAdapter` theo driver + connectionType:
 * - **ESC/POS**: luôn `NativeAdapter` — `printText` encode ở JS, không cần `read`.
 * - **TSPL / USB**: `NativeAdapter` — ghi byte thô qua `ThermalPrinterModule` (USB không đọc được, `identify` vẫn `null`).
 * - **TSPL / BLE-LAN**: `LibraryAdapter` — `tcp-socket`/`bluetooth-classic` đọc được phản hồi (cần cho `identify` `~!T`).
 */
export const resolvePrinterAdapter = (
  driverType: PrinterDriverType,
  connectionType: PrinterConnectionType,
): IPrinterAdapter => {
  if (driverType === PrinterDriverType.EscPos) {
    return new NativeAdapter();
  }

  if (connectionType === PrinterConnectionType.Usb) {
    return new NativeAdapter();
  }

  return new LibraryAdapter();
};

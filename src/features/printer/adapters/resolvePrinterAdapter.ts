import type { IPrinterAdapter } from './IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import { PrintLanguage } from '../models/printer/PrinterLanguage';
import { NativeAdapter } from './native/NativeAdapter';
import { LibraryAdapter } from './library/LibraryAdapter';

/**
 * Chọn `IPrinterAdapter` theo driver + connectionType:
 * - **ESC/POS**: luôn `NativeAdapter` — `printText` encode ở JS, không cần `read`.
 * - **TSPL / USB**: `NativeAdapter` — ghi/đọc byte thô qua native module `DeviceModule`.
 * - **TSPL / BLE-LAN**: `LibraryAdapter` — `tcp-socket`/`bluetooth-classic` đọc được phản hồi (cần cho `identify` `~!T`).
 */
export const resolvePrinterAdapter = (
  driverType: PrintLanguage,
  connectionType: ConnectionType,
): IPrinterAdapter => {
  if (driverType === PrintLanguage.EscPos) {
    return new NativeAdapter();
  }

  if (connectionType === ConnectionType.Usb) {
    return new NativeAdapter();
  }

  return new LibraryAdapter();
};

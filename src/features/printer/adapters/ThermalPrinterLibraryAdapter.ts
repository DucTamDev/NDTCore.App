import { USBPrinter, BLEPrinter, NetPrinter } from '../vendor/thermal-receipt-printer';
import type { ConnectionType } from '../types/printer.types';

export interface ThermalPrinterPrintTextOptions {
  keepConnection: boolean;
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}

/**
 * Boundary duy nhất giữa `EscPosDriver` và module vendored
 * `printer/vendor/thermal-receipt-printer` (spec §2.3 — ngoại lệ
 * pragmatic: module gộp connect+encode+write theo namespace riêng cho
 * từng connectionType; `EscPosDriver` vẫn tự chọn namespace nội bộ). Adapter
 * này chỉ re-export namespace + chuẩn hoá `printText()` (callback-based)
 * thành Promise — không chứa business logic về máy in.
 */
interface ThermalPrinterNamespaceMap {
  usb: typeof USBPrinter;
  bluetooth: typeof BLEPrinter;
  lan: typeof NetPrinter;
}

const namespaces: ThermalPrinterNamespaceMap = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };

export const ThermalPrinterLibraryAdapter = {
  /**
   * Generic theo `T extends ConnectionType` (thay vì trả union) để caller
   * gọi `namespaceFor('lan').connectPrinter(ip, port)` được TypeScript suy
   * luận đúng overload của từng namespace — 3 namespace có `connectPrinter`
   * khác chữ ký hẳn nhau (LAN: `(host, port)`, BLE: `(mac)`, USB:
   * `(vendorId, productId)`), trả union sẽ làm TS giao (intersect) tham số
   * của cả 3 chữ ký lại thành `never`.
   */
  namespaceFor: <T extends ConnectionType>(connectionType: T): ThermalPrinterNamespaceMap[T] => namespaces[connectionType],

  printTextAsync(connectionType: ConnectionType, text: string, options: ThermalPrinterPrintTextOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      ThermalPrinterLibraryAdapter.namespaceFor(connectionType).printText(
        text,
        options,
        () => resolve(),
        (error: Error) => reject(error),
      );
    });
  },
};

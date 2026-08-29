import { USBPrinter, BLEPrinter, NetPrinter } from './ThermalPrinterNativeModule';
import type { ConnectionType } from '../../types/printer.types';

export interface ThermalPrinterPrintTextOptions {
  keepConnection: boolean;
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}

/**
 * Boundary giữa `EscPosDriver` và lớp JS của native module RN*Printer
 * (`./index` — 3 namespace USB/BLE/Net, spec §2.3 ngoại lệ pragmatic: gộp
 * connect+encode+write theo connectionType thay vì đi qua `Transport` chung).
 * Adapter này chỉ chọn namespace theo connectionType + chuẩn hoá `printText()`
 * (callback) thành Promise — không chứa business logic về máy in.
 */
interface ThermalPrinterNamespaceMap {
  usb: typeof USBPrinter;
  bluetooth: typeof BLEPrinter;
  lan: typeof NetPrinter;
}

const namespaces: ThermalPrinterNamespaceMap = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };

export const ThermalPrinterAdapter = {
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
      ThermalPrinterAdapter.namespaceFor(connectionType).printText(
        text,
        options,
        () => resolve(),
        (error: Error) => reject(error),
      );
    });
  },
};

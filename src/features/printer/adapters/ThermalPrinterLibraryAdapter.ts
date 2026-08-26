import { USBPrinter, BLEPrinter, NetPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { ConnectionType } from '../types/printer.types';

export interface ThermalPrinterPrintTextOptions {
  keepConnection: boolean;
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}

/**
 * Boundary duy nhất giữa `EscPosDriver` và thư viện vendor
 * `@poriyaalar/react-native-thermal-receipt-printer` (spec §2.3 — ngoại lệ
 * pragmatic: thư viện gộp connect+encode+write theo namespace riêng cho
 * từng connectionType; `EscPosDriver` vẫn tự chọn namespace nội bộ). Adapter
 * này chỉ re-export namespace + chuẩn hoá `printText()` (callback-based)
 * thành Promise — không chứa business logic về máy in.
 */
export const ThermalPrinterLibraryAdapter = {
  namespaceFor: (connectionType: ConnectionType) =>
    ({ usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter })[connectionType],

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

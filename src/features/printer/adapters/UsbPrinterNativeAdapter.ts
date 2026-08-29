import { NativeModules } from 'react-native';
import { USBPrinter } from '../vendor/thermal-receipt-printer';

let initPromise: Promise<void> | null = null;

/**
 * Native module `RNUSBPrinter` (com.ndtcorepos.thermalprinter, vendored trong repo)
 * là singleton dùng chung giữa `ThermalReceiptDriver` (escpos) và `TsplDriver`
 * (tspl, qua `UsbTransport`) — gọi `init()` 2 lần từ 2 driver độc lập sẽ đăng
 * ký trùng `BroadcastReceiver` ở tầng native (`USBPrinterAdapter.init()`).
 * Memoize promise ở đây để toàn app chỉ `init()` đúng 1 lần bất kể driver nào
 * gọi trước.
 */
export const ensureUsbInitialized = (): Promise<void> => {
  if (!initPromise) initPromise = USBPrinter.init();
  return initPromise;
};

/**
 * `printRawData` có sẵn ở tầng native (`USBPrinterAdapter.printRawData` —
 * decode base64 rồi `bulkTransfer()` gửi nguyên byte, không qua biến đổi
 * ESC/POS nào) nhưng module JS vendored chỉ expose `printText`/`printBill` —
 * gọi thẳng native module cho TSPL, vốn là giao thức byte thô không đi qua
 * `printText` được.
 */
export const printRawDataUsb = (base64Data: string, keepConnection: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    NativeModules.RNUSBPrinter.printRawData(
      base64Data,
      keepConnection,
      () => resolve(),
      (error: Error) => reject(error),
    );
  });

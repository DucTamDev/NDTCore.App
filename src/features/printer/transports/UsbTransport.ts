// src/features/printer/transports/UsbTransport.ts
import { USBPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import { Buffer } from 'buffer';
import { AppErrorException, AppErrorCode } from '../types/AppError';
import { ensureUsbInitialized, printRawDataUsb } from '../adapters/UsbPrinterNativeAdapter';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Transport TSPL-qua-USB, dùng chung native module `RNUSBPrinter` với
 * `ThermalReceiptDriver` (escpos) — xem `UsbPrinterNative.ts` cho lý do cần
 * memoize `init()` dùng chung. Không có khả năng đọc phản hồi (chỉ có
 * bulk-OUT endpoint ở tầng native), nên không có `readOnce()` như
 * `LanTransport`/`BluetoothTransport` — `TsplDriver.identify()` đã tự loại
 * USB khỏi việc dò `~!T` bằng cách kiểm tra `'readOnce' in transport`.
 */
export class UsbTransport {
  async connect(vendorId: number, productId: number): Promise<void> {
    await ensureUsbInitialized();
    try {
      await USBPrinter.connectPrinter(vendorId as unknown as string, productId as unknown as string);
    } catch (error) {
      throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: errorMessage(error) });
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    try {
      await printRawDataUsb(Buffer.from(bytes).toString('base64'), true);
    } catch (error) {
      throw new AppErrorException({ code: AppErrorCode.PRINT_ERROR, message: errorMessage(error) });
    }
  }

  async close(): Promise<void> {
    try {
      await USBPrinter.closeConn();
    } catch (error) {
      throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: errorMessage(error) });
    }
  }
}

import { USBPrinter, ensureUsbInitialized, printRawDataUsb } from '../adapters/native/PrinterNativeModule';
import { Buffer } from 'buffer';
import { PrinterErrorException, PrinterErrorCode } from '../types/PrinterError';
import { LoggerService } from '../../../services/LoggerService';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Android `UsbDeviceConnection.bulkTransfer(ep, buf, len, timeout)` fail (trả
 * `-1` ngay, không phải timeout) khi `len` vượt giới hạn 1 transfer (~16KB tuỳ
 * kernel). Print bill/tem vài KB đi 1 lần bình thường; font `DOWNLOAD` (~145KB)
 * hoặc bitmap dài phải chia. Gửi từng chunk với `keepConnection=true` — máy in
 * TSPL đệm input thành 1 luồng, `DOWNLOAD` đọc đúng `byteCount` đã khai báo bất
 * kể chia mấy lần.
 */
const USB_WRITE_CHUNK_BYTES = 16 * 1024;

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
      await USBPrinter.connectPrinter(vendorId, productId);
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: errorMessage(error) });
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    const totalChunks = Math.max(1, Math.ceil(bytes.length / USB_WRITE_CHUNK_BYTES));
    LoggerService.debug('UsbTransport.write', { totalBytes: bytes.length, totalChunks, chunkSize: USB_WRITE_CHUNK_BYTES });
    let index = 0;
    try {
      for (let offset = 0; offset < bytes.length; offset += USB_WRITE_CHUNK_BYTES) {
        const chunk = bytes.subarray(offset, offset + USB_WRITE_CHUNK_BYTES);
        index += 1;
        await printRawDataUsb(Buffer.from(chunk).toString('base64'), true);
        LoggerService.debug(`UsbTransport.write: chunk ${index}/${totalChunks} OK`, { bytes: chunk.length });
      }
    } catch (error) {
      LoggerService.warning(`UsbTransport.write: chunk ${index}/${totalChunks} FAIL`, { error: errorMessage(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: errorMessage(error) });
    }
  }

  async close(): Promise<void> {
    try {
      await USBPrinter.closeConn();
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: errorMessage(error) });
    }
  }
}

import RNBluetoothClassic, { type BluetoothDevice } from 'react-native-bluetooth-classic';
import { Buffer } from 'buffer';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';
import { CONNECT_TIMEOUT_MS } from './transport.config';

export class BluetoothTransport {
  private device: BluetoothDevice | null = null;

  /**
   * `RNBluetoothClassic.connectToDevice` không có timeout riêng — 1 thiết bị
   * mất kết nối/ngoài tầm có thể khiến promise treo vô thời hạn, kẹt luôn
   * spinner "Đang kết nối..." của wizard. Đua với `timeoutMs`; nếu kết nối
   * thật vẫn thành công sau khi đã timeout, disconnect() ngay để không bỏ
   * lại 1 kết nối không ai theo dõi.
   */
  async connect(deviceId: string, timeoutMs: number = CONNECT_TIMEOUT_MS): Promise<void> {
    const connectPromise = RNBluetoothClassic.connectToDevice(deviceId);
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_TIMEOUT, message: 'Kết nối Bluetooth quá thời gian chờ' }));
      }, timeoutMs);
    });

    try {
      this.device = await Promise.race([connectPromise, timeoutPromise]);
      clearTimeout(timer!);
    } catch (err) {
      clearTimeout(timer!);
      if (timedOut) {
        connectPromise.then((device) => device.disconnect().catch(() => undefined)).catch(() => undefined);
      }
      throw err;
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: 'Thiết bị Bluetooth chưa được kết nối' });
    }
    await this.device.write(Buffer.from(bytes).toString('base64'), 'base64');
  }

  /**
   * Đọc 1 lần dữ liệu phản hồi từ thiết bị trong `timeoutMs`, dùng cho
   * `TsplDriver.identify()` — không dùng cho luồng in bình thường (chỉ ghi).
   */
  readOnce(timeoutMs: number): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      if (!this.device) {
        resolve(null);
        return;
      }
      const subscription = this.device.onDataReceived((event) => {
        clearTimeout(timer);
        subscription.remove();
        resolve(new Uint8Array(Buffer.from(event.data, 'base64')));
      });
      const timer = setTimeout(() => {
        subscription.remove();
        resolve(null);
      }, timeoutMs);
    });
  }

  /**
   * `device.disconnect()` có thể reject (Bluetooth mất kết nối/ngoài tầm
   * trước khi kịp đóng chủ động) — luôn xoá `this.device` trong `finally` dù
   * native disconnect thành công hay không, nếu không transport sẽ giữ mãi
   * 1 device reference chết, khiến `write()`/`identify()` sau đó tưởng vẫn
   * còn kết nối.
   */
  async close(): Promise<void> {
    try {
      await this.device?.disconnect();
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.device = null;
    }
  }
}

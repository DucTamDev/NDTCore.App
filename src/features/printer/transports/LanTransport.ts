import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import { PrinterErrorException, PrinterErrorCode } from '../types/PrinterError';
import { CONNECT_TIMEOUT_MS } from './transportConfig';

/**
 * `react-native-tcp-socket` không export type `Socket` ở top-level (chỉ export
 * qua namespace mặc định), nên type instance được suy ra từ giá trị trả về của
 * `createConnection`.
 */
type LanSocket = ReturnType<typeof TcpSocket.createConnection>;

export class LanTransport {
  private socket: LanSocket | null = null;

  /**
   * Máy in LAN mất kết nối/tắt nguồn có thể khiến `createConnection` treo vô
   * thời hạn — chưa từng gọi `onConnect` cũng chưa emit `error`. Đua với
   * `timeoutMs`; nếu hết giờ, huỷ socket đang treo (`destroy()`) trước khi
   * reject, không để lại kết nối không ai theo dõi.
   */
  connect(ip: string, port: number, timeoutMs: number = CONNECT_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      // Tạo timer TRƯỚC khi gọi createConnection — 1 số trường hợp (kể cả
      // trong test lẫn kết nối thật cực nhanh) callback connect có thể chạy
      // đồng bộ, nếu timer khai báo sau thì clearTimeout(timer) bên trong
      // callback đó chạy trước khi `timer` được gán, để lại 1 timer mồ côi
      // không bao giờ bị huỷ.
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.destroy();
        this.socket = null;
        reject(new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_TIMEOUT, message: 'Kết nối LAN quá thời gian chờ' }));
      }, timeoutMs);
      const socket = TcpSocket.createConnection({ host: ip, port }, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      });
      socket.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Socket 'error' lúc connect = từ chối kết nối / host không tới được —
        // map sang PRINTER_CONNECTION_FAILED để `errorCodeOf()` không trả
        // UNKNOWN_ERROR cho lỗi LAN phổ biến nhất (spec §6.2).
        reject(new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error.message }));
      });
      this.socket = socket;
    });
  }

  write(bytes: Uint8Array): void {
    if (!this.socket) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: 'LAN socket chưa được kết nối' });
    }
    this.socket.write(bytes);
  }

  /**
   * Đọc 1 lần dữ liệu phản hồi từ socket trong `timeoutMs`, dùng cho
   * `TsplDriver.identify()` — không dùng cho luồng in bình thường (chỉ ghi).
   */
  readOnce(timeoutMs: number): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(null);
        return;
      }
      const socket = this.socket;
      const onData = (data: Buffer | string): void => {
        clearTimeout(timer);
        socket.removeListener('data', onData);
        const buffer = typeof data === 'string' ? Buffer.from(data) : data;
        resolve(new Uint8Array(buffer));
      };
      const timer = setTimeout(() => {
        socket.removeListener('data', onData);
        resolve(null);
      }, timeoutMs);
      socket.on('data', onData);
    });
  }

  close(): void {
    this.socket?.destroy();
    this.socket = null;
  }
}

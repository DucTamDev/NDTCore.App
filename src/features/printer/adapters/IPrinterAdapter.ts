import type { ConnectionType } from '../models/printer/ConnectionType';
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import type { DiscoverResult } from '../models/discovery/DiscoverResult';

/** Huỷ một đăng ký lắng nghe. */
export type Unsubscribe = () => void;

/**
 * Một cách giao tiếp với máy in: `native` là native module của app, `vendor` là SDK của hãng máy in.
 * Mỗi instance giữ tối đa một kết nối; `listDevices` gọi được khi chưa kết nối.
 */
export interface IPrinterAdapter {
  readonly source: 'native' | 'vendor';

  /** `false` thì `read` luôn trả `null`, không đọc được phản hồi của máy in. */
  readonly canRead: boolean;

  /** Thiết bị tìm thấy cho một loại kết nối; `[]` nếu adapter không quét loại đó. */
  listDevices(connectionType: ConnectionType): Promise<DiscoverResult[]>;

  /** Mở kết nối; mở được rồi mới trả kết nối cũ của chính instance này. */
  connect(connection: PrinterConnection): Promise<void>;

  write(bytes: Uint8Array): Promise<void>;

  /** Phản hồi của máy in; `null` khi quá hạn mà máy in chưa trả lời. */
  read(): Promise<Uint8Array | null>;

  /** Báo khi kết nối hiện tại của instance này mất ngoài ý muốn (rút cáp, tắt máy, mất sóng). */
  onLost(callback: () => void): Unsubscribe;

  disconnect(): Promise<void>;
}

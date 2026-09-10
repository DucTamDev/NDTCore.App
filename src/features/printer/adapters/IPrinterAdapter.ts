import type { PrinterDevice } from '../models/printer/PrinterDevice';
import type { PrinterConnectionType } from '../models/printer/PrinterConnection';
import type { Printer } from '../models/printer/Printer';

/**
 * Mục tiêu kết nối 1 máy in — phẳng theo `connectionType`, driver dựng từ
 * `Printer` (xem `toConnectTarget`). Adapter chỉ đọc field khớp `connectionType`.
 */
export interface PrinterConnectTarget {
  printerId: string;
  connectionType: PrinterConnectionType;
  lan?: { ip: string; port: number };
  bluetooth?: { deviceId: string };
  usb?: { vendorId: number; productId: number };
}

/** Tuỳ chọn khi để adapter tự encode ESC/POS (`printText`). */
export interface PrinterPrintTextOptions {
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}

/**
 * Contract chung cho MỌI cách feature máy in giao tiếp ra ngoài, phân theo
 * nguồn cơ chế:
 * - `native`  — native module tự viết (`PrinterNativeModule` → `ThermalPrinterModule`)
 * - `library` — thư viện npm (`react-native-tcp-socket` / `-bluetooth-classic`)
 * - `vendor`  — SDK do hãng máy in cung cấp
 *
 * 1 instance = 1 kết nối (stateful, giống `Transport`). Driver tạo mới mỗi
 * `printerId`. `listDevices` gọi được trước `connect` (không cần kết nối).
 */
export interface IPrinterAdapter {
  readonly source: 'native' | 'library' | 'vendor';

  /**
   * `true` nếu `read()` thực sự đọc được phản hồi từ máy in. `false` (native —
   * chỉ bulk-OUT) thì caller KHÔNG được ghi lệnh dò (`~!T`…) rồi chờ đọc —
   * `TsplDriver.identify()` phải trả `null` ngay, không ghi.
   */
  readonly canRead: boolean;

  /** Liệt kê thiết bị cho 1 connectionType — `[]` nếu adapter không quét loại đó. */
  listDevices(connectionType: PrinterConnectionType): Promise<PrinterDevice[]>;

  /** Mở kết nối. Idempotent phần init tầng dưới. */
  connect(target: PrinterConnectTarget): Promise<void>;

  /** Ghi byte thô (TSPL, hoặc ESC/POS đã encode ở driver). */
  write(bytes: Uint8Array): Promise<void>;

  /** Encode ESC/POS từ `text` (có tag `<C>`/`<B>`…) rồi gửi. */
  printText(text: string, options: PrinterPrintTextOptions): Promise<void>;

  /** Đọc 1 lần phản hồi trong `timeoutMs` — `null` nếu adapter/kết nối không đọc được (vd USB). */
  read(timeoutMs: number): Promise<Uint8Array | null>;

  /** Đóng kết nối. */
  disconnect(): Promise<void>;
}

/**
 * Dựng `PrinterConnectTarget` từ `Printer` — `printer.connection` là
 * discriminated union nên không còn trạng thái thiếu cấu hình để validate ở
 * đây (khác bản cũ dùng field optional dùng chung).
 */
export const toConnectTarget = (printer: Printer): PrinterConnectTarget => {
  const { connection } = printer;

  if (connection.type === 'Lan') {
    return { printerId: printer.id, connectionType: connection.type, lan: { ip: connection.host, port: connection.port } };
  }

  if (connection.type === 'Bluetooth') {
    return { printerId: printer.id, connectionType: connection.type, bluetooth: { deviceId: connection.deviceId } };
  }

  return { printerId: printer.id, connectionType: connection.type, usb: { vendorId: connection.vendorId, productId: connection.productId } };
};

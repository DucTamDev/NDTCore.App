import type { ConnectionType, PrinterDevice, UsbRawDevice } from '../models/printer/PrinterDevice';
import type { Printer } from '../models/printer/Printer';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';

/**
 * Mục tiêu kết nối 1 máy in — phẳng theo `connectionType`, driver dựng từ
 * `Printer` (xem `toConnectTarget`). Adapter chỉ đọc field khớp `connectionType`.
 */
export interface PrinterConnectTarget {
  connectionType: ConnectionType;
  lan?: { ip: string; port: number };
  bluetooth?: { deviceId: string };
  usb?: { vendorId: number; productId: number };
}

/** Tuỳ chọn khi để adapter tự encode ESC/POS (`printText`). */
export interface PrinterPrintTextOptions {
  keepConnection: boolean;
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
  listDevices(connectionType: ConnectionType): Promise<PrinterDevice[]>;

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
 * Dựng `PrinterConnectTarget` từ `Printer` — ném `VALIDATION_ERROR` nếu thiếu
 * cấu hình cho `connectionType` tương ứng.
 */
export const toConnectTarget = (printer: Printer): PrinterConnectTarget => {
  if (printer.connection.type === 'lan') {
    if (!printer.connection.lan) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
    return { connectionType: printer.connection.type, lan: { ip: printer.connection.lan.ip, port: printer.connection.lan.port } };
  }
  if (printer.connection.type === 'bluetooth') {
    if (!printer.connection.device) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
    return { connectionType: printer.connection.type, bluetooth: { deviceId: printer.connection.device.deviceId } };
  }
  const raw = printer.connection.device?.rawDevice as unknown as UsbRawDevice | undefined;
  if (!raw) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
  return { connectionType: printer.connection.type, usb: { vendorId: Number(raw.vendor_id), productId: Number(raw.product_id) } };
};

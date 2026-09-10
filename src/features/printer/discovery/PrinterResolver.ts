import type { PrinterDevice, UsbRawDevice } from '../models/printer/PrinterDevice';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import type { BluetoothPrinterConnection, LanPrinterConnection, PrinterConnection, UsbPrinterConnection } from '../models/printer/PrinterConnection';

/**
 * Dựng `UsbPrinterConnection` từ 1 `PrinterDevice` đã chọn lúc scan — đọc
 * `vendorId`/`productId`/`serialNumber` từ `rawDevice` MỘT LẦN ở đây, thay vì
 * để mọi nơi dùng (`toConnectTarget`, resource key, identity key) tự đọc lại
 * `rawDevice` (kiểu `Record<string, unknown>` không an toàn).
 */
export const buildUsbConnection = (device: PrinterDevice): UsbPrinterConnection => {
  const raw = device.rawDevice as unknown as UsbRawDevice;
  const connection: UsbPrinterConnection = { type: PrinterConnectionType.Usb, vendorId: Number(raw.vendorId), productId: Number(raw.productId) };
  return raw.serialNumber ? { ...connection, serialNumber: raw.serialNumber } : connection;
};

/** Dựng `BluetoothPrinterConnection` từ 1 `PrinterDevice` đã chọn lúc scan. */
export const buildBluetoothConnection = (device: PrinterDevice): BluetoothPrinterConnection => {
  const connection: BluetoothPrinterConnection = { type: PrinterConnectionType.Bluetooth, deviceId: device.deviceId };
  return device.displayName ? { ...connection, name: device.displayName } : connection;
};

/** Dựng `LanPrinterConnection` từ IP/port đã nhập (form Add Printer). */
export const buildLanConnection = (host: string, port: number): LanPrinterConnection => ({ type: PrinterConnectionType.Lan, host, port });

/**
 * Chiều ngược lại `buildUsbConnection`/`buildBluetoothConnection` — dựng lại
 * `PrinterDevice`-shape để seed `selectedDevice` state lúc SỬA 1 printer đã
 * lưu (connection không đổi trong lúc sửa, chỉ cần feed lại đúng
 * `vendorId`/`productId`/`serialNumber`/`deviceId` khi `buildDraftPrinter()`
 * dựng lại connection lúc Save). Không phải dữ liệu scan thật nên
 * `displayName` để rỗng khi không có `name` (Bluetooth) — không dùng để hiển
 * thị, chỉ để round-trip lại đúng connection.
 */
export const deviceFromConnection = (connection: PrinterConnection): PrinterDevice | undefined => {
  if (connection.type === PrinterConnectionType.Usb) {
    const rawDevice: UsbRawDevice = { vendorId: connection.vendorId, productId: connection.productId, serialNumber: connection.serialNumber };
    return { deviceId: `${connection.vendorId}:${connection.productId}`, displayName: '', rawDevice: rawDevice as unknown as Record<string, unknown> };
  }

  if (connection.type === PrinterConnectionType.Bluetooth) {
    return { deviceId: connection.deviceId, displayName: connection.name ?? '', rawDevice: {} };
  }

  return undefined;
};

/**
 * Tính identityKey của 1 physical printer — CHỈ phụ thuộc `PrinterConnection`,
 * không phụ thuộc driver/protocol nào được gán (spec §6.1). KHÔNG tự quyết
 * định "có phải trùng lặp không" — so khớp với printer đã lưu là việc của
 * `storage/PrinterRepository.ts` (spec §6.2).
 *
 * USB: `usb:<vendorId>:<productId>[:<serialNumber>]`. Serial (từ
 * `USBPrinter.getDeviceList()`, cần quyền USB — có sau khi user "Kết nối") pin
 * thêm vào để rút/cắm lại đổi bus path vẫn nhận ra cùng máy. Không có serial
 * thì chỉ `vendorId:productId` — KHÔNG phân biệt được 2 máy cùng model cắm
 * cùng lúc.
 */
export const resolveIdentityKey = (connection: PrinterConnection): string => {
  if (connection.type === PrinterConnectionType.Lan) {
    return `lan:${connection.host}:${connection.port}`;
  }

  if (connection.type === PrinterConnectionType.Bluetooth) {
    return `bluetooth:mac:${connection.deviceId}`;
  }

  return connection.serialNumber
    ? `usb:${connection.vendorId}:${connection.productId}:${connection.serialNumber}`
    : `usb:${connection.vendorId}:${connection.productId}`;
};

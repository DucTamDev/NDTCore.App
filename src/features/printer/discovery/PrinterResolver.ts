import type { PrinterDevice, UsbRawDevice } from '../models/printer/PrinterDevice';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { BluetoothPrinterConnection, LanPrinterConnection, PrinterConnection, UsbPrinterConnection } from '../models/printer/PrinterConnection';

/**
 * Dựng `UsbPrinterConnection` từ 1 `PrinterDevice` đã chọn lúc scan — đọc
 * `vendorId`/`productId`/`serialNumber` từ `rawDevice` MỘT LẦN ở đây, thay vì
 * để mọi nơi dùng (`toConnectTarget`, resource key, identity key) tự đọc lại
 * `rawDevice` (kiểu `Record<string, unknown>` không an toàn).
 */
export const buildUsbConnection = (device: PrinterDevice): UsbPrinterConnection => {
  const raw = device.rawDevice as unknown as UsbRawDevice;
  const connection: UsbPrinterConnection = { type: ConnectionType.Usb, vendorId: Number(raw.vendorId), productId: Number(raw.productId) };
  return raw.serialNumber ? { ...connection, serialNumber: raw.serialNumber } : connection;
};

/** Dựng `BluetoothPrinterConnection` từ 1 `PrinterDevice` đã chọn lúc scan. */
export const buildBluetoothConnection = (device: PrinterDevice): BluetoothPrinterConnection => {
  const connection: BluetoothPrinterConnection = { type: ConnectionType.Bluetooth, mac: device.deviceId };
  return connection;
};

/** Dựng `LanPrinterConnection` từ IP/port đã nhập (form Add Printer). */
export const buildLanConnection = (host: string, port: number): LanPrinterConnection => ({ type: ConnectionType.Lan, host, port });

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
  if (connection.type === ConnectionType.Usb) {
    const rawDevice: UsbRawDevice = { vendorId: connection.vendorId, productId: connection.productId, serialNumber: connection.serialNumber };
    return { deviceId: `${connection.vendorId}:${connection.productId}`, displayName: '', rawDevice: rawDevice as unknown as Record<string, unknown> };
  }

  if (connection.type === ConnectionType.Bluetooth) {
    return { deviceId: connection.mac, displayName: '', rawDevice: {} };
  }

  return undefined;
};

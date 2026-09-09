import type { PrinterError } from '../../errors/PrinterError';

/**
 * 3 cái tên giống nhau (`PrinterDevice`, `PrinterConnection`, `PrinterDeviceInfo`)
 * ứng với 3 GIAI ĐOẠN khác nhau trong vòng đời 1 máy in — không phải 3 cách gọi
 * khác nhau của cùng 1 thứ:
 *
 * ```text
 * 1. SCAN      → PrinterDevice        (file này)      — kết quả quét thô, CHƯA connect,
 *                                                        CHƯA lưu. deviceId/displayName/
 *                                                        rawDevice — chung shape cho usb/bluetooth.
 * 2. CHỌN + LƯU → PrinterConnection   (./PrinterConnection.ts) — sau khi user chọn 1
 *                                                        PrinterDevice, PrinterResolver đọc
 *                                                        rawDevice rồi convert/flatten thành
 *                                                        đúng field cần lưu theo từng loại
 *                                                        connection (usb/bluetooth/lan).
 *                                                        Đây là field `Printer.connection` —
 *                                                        cái THỰC SỰ được lưu vào storage.
 * 3. IDENTIFY  → PrinterDeviceInfo    (file này)      — SAU KHI đã connect, driver.identify()
 *                                                        trả tên máy/hãng/model để XÁC NHẬN
 *                                                        (hiển thị UI "đã kết nối XP-420B"),
 *                                                        không dùng để lưu hay tính identity/
 *                                                        resource key.
 * ```
 *
 * `PrinterDevice` và `PrinterDeviceInfo` không lồng nhau, không thay thế cho
 * nhau — 1 phiên Add Printer đi qua CẢ 2 lẫn `PrinterConnection`, ở 3 thời
 * điểm khác nhau.
 */
export const ConnectionType = {
  usb: 'usb',
  bluetooth: 'bluetooth',
  lan: 'lan',
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];

/**
 * 1 kết quả SCAN — thiết bị user CÓ THỂ chọn, chưa connect, chưa lưu. Shape
 * chung cho usb/bluetooth (native trả về đủ để hiển thị list chọn); KHÔNG
 * phải shape lưu trữ — xem `PrinterConnection` (giai đoạn kế tiếp) cho shape
 * thực sự ghi vào `Printer.connection`.
 */
export interface PrinterDevice {
  /** Khoá hiển thị/chọn trong list scan — usb: `"<vendorId>:<productId>"`; bluetooth: MAC address. KHÔNG phải `Printer.identityKey`. */
  deviceId: string;
  displayName: string;
  /** Payload gốc từ native, hình dạng phụ thuộc `connectionType` — cast sang `UsbRawDevice` khi biết chắc là usb (xem dưới). */
  rawDevice: Record<string, unknown>;
}

/**
 * Hình dạng `PrinterDevice.rawDevice` khi `connectionType === 'usb'` — khớp
 * `PrinterInfoDto` từ native (`vendorId`/`productId` luôn có; `serialNumber`
 * cần quyền USB Android 10+, có thể null lúc scan lần đầu).
 */
export interface UsbRawDevice {
  vendorId: number;
  productId: number;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
}

/**
 * Kết quả `IPrinterDriver.identify()` SAU KHI đã connect — dùng để XÁC NHẬN
 * (hiển thị UI) đúng máy in nào đang kết nối, không phải dữ liệu quét hay dữ
 * liệu kết nối. Nhiều field optional vì không phải adapter nào cũng đọc được
 * đủ — BLE/LAN qua `NativeAdapter` chỉ trả `{}` (không có discriminator thật),
 * USB luôn trả `null` (không tự xác nhận qua USB, xem CLAUDE.md).
 */
export interface PrinterDeviceInfo {
  deviceName?: string;
  vendor?: string;
  model?: string;
}

export const DeviceScanEventType = {
  loading: 'loading',
  found: 'found',
  empty: 'empty',
  error: 'error',
} as const;

export type DeviceScanEventType = (typeof DeviceScanEventType)[keyof typeof DeviceScanEventType];

export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: PrinterError;
}

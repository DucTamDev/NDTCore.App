import type { PrinterError } from '../../errors/PrinterError';

/** 2 giai đoạn của 1 máy in: scan (`PrinterDevice`) → identify sau khi connect (`PrinterDeviceInfo`). Kết nối đã lưu xem `PrinterConnection.ts`. */

/** 1 kết quả scan — thiết bị user có thể chọn, chưa connect, chưa lưu. */
export interface PrinterDevice {
  /** usb: `"<vendorId>:<productId>"`; bluetooth: MAC address. */
  deviceId: string;
  displayName: string;
  /** Payload gốc từ native — cast sang `UsbRawDevice` khi biết chắc là usb. */
  rawDevice: Record<string, unknown>;
}

/**
 * Hình dạng `PrinterDevice.rawDevice` khi `connectionType === PrinterConnectionType.Usb` — khớp
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

/** Kết quả `IPrinterDriver.identify()` sau khi connect — chỉ để hiển thị xác nhận, không dùng để lưu. */
export interface PrinterDeviceInfo {
  deviceName?: string;
  vendor?: string;
  model?: string;
}

export const DeviceScanEventType = { Loading: 'Loading', Found: 'Found', Empty: 'Empty', Error: 'Error' } as const;
export type DeviceScanEventType = (typeof DeviceScanEventType)[keyof typeof DeviceScanEventType];
export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: PrinterError;
}

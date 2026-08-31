import type { PrinterError } from '../../errors/PrinterError';

export const ConnectionType = {
  usb: 'usb',
  bluetooth: 'bluetooth',
  lan: 'lan',
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];

export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>;
}

/**
 * Hình dạng `PrinterDevice.rawDevice` khi `connectionType === 'usb'` — 1 phần tử
 * `IUSBPrinter` từ `USBPrinter.getDeviceList()`. `vendor_id`/`product_id` luôn
 * có; các field enrichment optional (`serialNumber` cần quyền USB Android 10+).
 */
export interface UsbRawDevice {
  vendor_id: number | string;
  product_id: number | string;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  version?: string | null;
  interfaces?: unknown[];
  hasBulkInEndpoint?: boolean;
  hasBulkOutEndpoint?: boolean;
}

export interface PrinterLanConfig {
  ip: string;
  port: number;
}

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

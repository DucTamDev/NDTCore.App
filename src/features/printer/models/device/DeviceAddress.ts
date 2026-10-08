import { ConnectionType } from '../connections/ConnectionType';

/** Địa chỉ thiết bị USB. */
export interface UsbDeviceAddress {
  type: typeof ConnectionType.Usb;

  vendorId: number;

  productId: number;

  /** Có khi đã được cấp quyền USB; phân biệt hai máy cùng model. */
  serialNumber?: string;
}

/** Địa chỉ thiết bị Bluetooth cổ điển (đã ghép đôi). */
export interface BluetoothDeviceAddress {
  type: typeof ConnectionType.Bluetooth;

  /** Địa chỉ MAC viết hoa. */
  mac: string;
}

/** Địa chỉ thiết bị trên mạng TCP. */
export interface LanDeviceAddress {
  type: typeof ConnectionType.Lan;

  host: string;

  port: number;
}

/** Địa chỉ để `connect` tới một thiết bị; đủ để kết nối lại mà không cần quét. */
export type DeviceAddress = UsbDeviceAddress | BluetoothDeviceAddress | LanDeviceAddress;

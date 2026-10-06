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

/**
 * Định danh máy in vật lý, chỉ phụ thuộc cách kết nối. USB gắn thêm serial (có sau khi được cấp quyền) để rút ra
 * cắm lại vẫn nhận đúng máy; không có serial thì không phân biệt được hai máy cùng model.
 */
export const deviceIdOf = (connection: DeviceAddress): string => {
  if (connection.type === ConnectionType.Lan) {
    return `lan:${connection.host}:${connection.port}`;
  }

  if (connection.type === ConnectionType.Bluetooth) {
    return `bluetooth:mac:${connection.mac.toUpperCase()}`;
  }

  const usbId = `usb:${connection.vendorId}:${connection.productId}`;
  return connection.serialNumber ? `${usbId}:${connection.serialNumber}` : usbId;
};

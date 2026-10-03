import { ConnectionType } from './ConnectionType';

/** Cách kết nối tới máy in qua USB. */
export interface UsbPrinterConnection {
  type: typeof ConnectionType.Usb;

  vendorId: number;

  productId: number;

  /** Có khi đã được cấp quyền USB; phân biệt hai máy cùng model. */
  serialNumber?: string;
}

/** Cách kết nối tới máy in qua Bluetooth cổ điển (đã ghép đôi). */
export interface BluetoothPrinterConnection {
  type: typeof ConnectionType.Bluetooth;

  /** Địa chỉ MAC viết hoa. */
  mac: string;
}

/** Cách kết nối tới máy in qua mạng TCP. */
export interface LanPrinterConnection {
  type: typeof ConnectionType.Lan;

  host: string;

  port: number;
}

/** Cách kết nối tới một máy in; đủ để kết nối lại mà không cần quét. */
export type PrinterConnection = UsbPrinterConnection | BluetoothPrinterConnection | LanPrinterConnection;

/**
 * Định danh máy in vật lý, chỉ phụ thuộc cách kết nối. USB gắn thêm serial (có sau khi được cấp quyền) để rút ra
 * cắm lại vẫn nhận đúng máy; không có serial thì không phân biệt được hai máy cùng model.
 */
export const deviceIdOf = (connection: PrinterConnection): string => {
  if (connection.type === ConnectionType.Lan) {
    return `lan:${connection.host}:${connection.port}`;
  }

  if (connection.type === ConnectionType.Bluetooth) {
    return `bluetooth:mac:${connection.mac.toUpperCase()}`;
  }

  const usbId = `usb:${connection.vendorId}:${connection.productId}`;
  return connection.serialNumber ? `${usbId}:${connection.serialNumber}` : usbId;
};

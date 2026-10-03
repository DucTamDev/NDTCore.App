import type { ConnectionType } from './ConnectionType';

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

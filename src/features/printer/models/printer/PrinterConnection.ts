/**
 * Thông tin kết nối đã lưu của 1 `Printer` — khác `PrinterDevice`
 * (PrinterDevice.ts) là kết quả scan tạm thời. Discriminated union theo
 * `type` để loại trừ trạng thái vô nghĩa (vd `usb` thiếu `vendorId`) ở
 * compile-time thay vì validate tay.
 */
export interface UsbPrinterConnection {
  type: 'usb';
  vendorId: number;
  productId: number;
  /** Cần quyền USB Android 10+ — có thể chưa có lúc scan lần đầu, xem `PrinterResolver`. */
  serialNumber?: string;
}

export interface BluetoothPrinterConnection {
  type: 'bluetooth';
  deviceId: string;
  /** Tên hiển thị lúc scan — chỉ để tham khảo, KHÔNG dùng cho identity/resource key. */
  name?: string;
}

export interface LanPrinterConnection {
  type: 'lan';
  host: string;
  port: number;
}

export type PrinterConnection =
  | UsbPrinterConnection
  | BluetoothPrinterConnection
  | LanPrinterConnection;

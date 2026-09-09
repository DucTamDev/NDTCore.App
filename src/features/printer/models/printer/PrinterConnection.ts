/**
 * Thông tin kết nối đã LƯU của 1 `Printer` — khác `PrinterDevice`
 * (models/printer/PrinterDevice.ts) là kết quả SCAN tạm thời trước khi user
 * chọn; xem doc comment đầu file đó cho vòng đời 3 giai đoạn đầy đủ (scan →
 * connection → identify).
 *
 * Discriminated union theo `type` — mỗi variant chỉ khai field khớp đúng
 * connection type đó, không có field optional dùng chung (ARCHITECTURE.md §7).
 * TypeScript/Zod tự loại trừ trạng thái vô nghĩa (vd `usb` mà thiếu
 * `vendorId`) thay vì phải validate bằng tay ở nơi dùng.
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

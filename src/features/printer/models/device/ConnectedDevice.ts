import type { DeviceAddress } from './DeviceAddress';

/** Kết quả kết nối: mã phiên kết nối và thông tin máy native đọc được sau khi mở. */
export interface ConnectedDevice {
  /** Mã phiên kết nối của native, dùng để nhận ra hai lần kết nối vào cùng một máy; hết hạn khi rút ra cắm lại. */
  connectionId: string;

  /** Định danh ổn định của máy vật lý do native tính sau khi mở; lưu vào `Printer.deviceId`. */
  deviceId: string;

  /** Địa chỉ đầy đủ sau khi mở (USB có serial nếu máy có); lưu vào `Printer.connection`. */
  address: DeviceAddress;

  /** Tên thiết bị (tên Bluetooth, tên sản phẩm USB), nếu đọc được. */
  name?: string;

  /** Nhà sản xuất, nếu đọc được (chỉ USB). */
  manufacturer?: string;

  /** Model hoặc tên sản phẩm, nếu đọc được (chỉ USB). */
  model?: string;
}

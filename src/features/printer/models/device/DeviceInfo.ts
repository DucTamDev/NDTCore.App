import type { DeviceAddress } from './DeviceAddress';

/** Một thiết bị tìm thấy khi quét, khớp `DeviceInfo` native trả về. */
export interface DeviceInfo {
  /** Định danh thiết bị trong lần discovery hiện tại (native trả về), dùng làm key danh sách. */
  deviceId: string;

  /** Tên thiết bị; native không có thì dùng MAC hoặc đường dẫn thiết bị. */
  name: string;

  /** Nhà sản xuất, nếu đọc được (chỉ USB). */
  manufacturer?: string;

  /** Model hoặc tên sản phẩm, nếu đọc được (chỉ USB). */
  model?: string;

  /** App đã được cấp quyền dùng thiết bị chưa; quét không mở hộp thoại xin quyền. */
  hasPermission: boolean;

  /** Địa chỉ để `connect`; chọn máy thì gán vào `Printer.connection`. */
  address: DeviceAddress;
}

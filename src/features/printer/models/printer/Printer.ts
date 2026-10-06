import type { PaperOptions } from '../paper/PaperOptions';
import type { PrintKind } from './PrintKind';
import type { PrinterCapabilities } from './PrinterCapabilities';
import type { DeviceAddress } from '../device/DeviceAddress';
import type { PrinterLanguage } from './PrinterLanguage';

/** Một máy in đã lưu: đúng một kết nối, một ngôn ngữ, một loại nội dung và một cấu hình giấy. */
export interface Printer {
  /** ID bản ghi, sinh khi tạo, không đổi khi sửa. */
  id: string;

  /** Máy vật lý, tính từ `connection` bằng `deviceIdOf`; cặp (`deviceId`, `kind`) là duy nhất. */
  deviceId: string;

  /** Loại nội dung máy nhận in (hoá đơn, tem). */
  kind: PrintKind;

  /** Tên hiển thị do người dùng đặt. */
  name: string;

  /** Hãng thiết bị, nếu đọc được lúc thêm máy. */
  vendor?: string;

  /** Model thiết bị, nếu đọc được lúc thêm máy. */
  model?: string;

  /** Cách kết nối tới máy (LAN, USB, Bluetooth). */
  connection: DeviceAddress;

  /** Ngôn ngữ lệnh (ESC/POS, TSPL) dùng để mã hoá ảnh in. */
  language: PrinterLanguage;

  /** Cấu hình giấy: loại, khổ, cách cắt. */
  paper: PaperOptions;

  /** Khả năng phần cứng (dao cắt, ngăn kéo tiền...). */
  capabilities: PrinterCapabilities;

  /** Tự kết nối lại khi mở app và khi mất kết nối lúc in. */
  autoReconnect: boolean;

  /** Tắt thì không nhận lệnh in nhưng vẫn giữ cấu hình. */
  enabled: boolean;

  /** Thời điểm tạo (ISO 8601 UTC). */
  createdAt: string;

  /** Thời điểm sửa gần nhất (ISO 8601 UTC). */
  updatedAt: string;
}

import type { PaperOptions } from '../paper/PaperOptions';
import type { PrintKind } from './PrintKind';
import type { PrinterCapabilities } from './PrinterCapabilities';
import type { PrinterConnection } from './PrinterConnection';
import type { PrinterLanguage } from './PrinterLanguage';

/** Một máy in đã lưu: đúng một kết nối, một ngôn ngữ, một loại nội dung và một cấu hình giấy. */
export interface Printer {
  /** ID của bản ghi, sinh khi tạo, không đổi khi sửa. */
  id: string;

  /**
   * Định danh máy in vật lý, tính từ `connection` bằng `deviceIdOf`, ổn định qua các lần cắm. Unique theo cặp
   * (`deviceId`, `kind`). Không so với `DeviceInfo.deviceId`.
   */
  deviceId: string;

  kind: PrintKind;

  /** Tên hiển thị do người dùng đặt. */
  name: string;

  /** Hãng thiết bị, nếu đọc được lúc thêm máy. */
  vendor?: string;

  /** Model thiết bị, nếu đọc được lúc thêm máy. */
  model?: string;

  connection: PrinterConnection;

  language: PrinterLanguage;

  paper: PaperOptions;

  capabilities: PrinterCapabilities;

  /** Tự kết nối lại khi mở app và khi mất kết nối lúc in. */
  autoReconnect: boolean;

  /** Tắt thì không nhận lệnh in nhưng vẫn giữ cấu hình. */
  enabled: boolean;

  /** Thời điểm tạo, ISO 8601 UTC. */
  createdAt: string;

  /** Thời điểm cập nhật, ISO 8601 UTC. */
  updatedAt: string;
}

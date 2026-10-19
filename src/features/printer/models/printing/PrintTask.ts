import type { ConnectionType } from '../connections/ConnectionType';
import type { PrintKind } from '../printer/PrintKind';

/** Dữ liệu một lệnh in gửi tới một máy in; một yêu cầu in tới nhiều máy sinh nhiều lệnh. Không lưu. */
export interface PrintTask {
  /** Định danh riêng của lệnh in. */
  id: string;

  /** Máy in (đã lưu) nhận lệnh. */
  printerId: string;

  /** Tên máy in lúc tạo lệnh, để log và hiển thị không phải tra lại danh sách máy in. */
  printerName: string;

  /** Máy vật lý nhận lệnh (`Printer.deviceId`); hai máy in đã lưu cùng một máy vật lý có cùng giá trị. */
  deviceId: string;

  /** Đường kết nối tới máy in lúc tạo lệnh. */
  connectionType: ConnectionType;

  /** Loại nội dung (hoá đơn, tem) của yêu cầu in. */
  kind: PrintKind;

  /** Ảnh cần in, dạng PNG base64 không có tiền tố `data:`. */
  data: string;

  /** Mô tả nội dung để báo lỗi và ghi log, vd `Hoá đơn #A1024`, `Tem #A1024 · ly 2/3`. */
  title: string;

  /** Thời điểm tạo lệnh (ISO 8601 UTC). */
  createdAt: string;
}

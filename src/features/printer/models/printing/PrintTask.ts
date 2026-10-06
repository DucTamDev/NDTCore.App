import type { PrinterFeatureException } from '../../exceptions';
import type { ConnectionType } from '../printer/ConnectionType';
import type { PrintKind } from '../printer/PrintKind';
import type { PrintTaskStatus } from './PrintTaskStatus';

/** Một lệnh in gửi tới một máy in; một yêu cầu in tới nhiều máy sinh nhiều lệnh. Chỉ sống trong bộ nhớ, không lưu. */
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

  /** Nội dung in: ảnh PNG base64 (không tiền tố `data:`), encode theo ngôn ngữ của máy lúc gửi. */
  data: string;

  /** Trạng thái hiện tại trong hàng đợi. */
  status: PrintTaskStatus;

  /** Số lần đã in lại sau khi lỗi; lần in đầu là 0. */
  retryCount: number;

  /** Lỗi của lần in gần nhất; chỉ có khi `status` là `Failed`. */
  error?: PrinterFeatureException;

  /** Thời điểm tạo lệnh (ISO 8601 UTC). */
  createdAt: string;

  /** Thời điểm bắt đầu gửi tới máy in (ISO 8601 UTC); chưa tới lượt thì chưa có. */
  startedAt?: string;

  /** Thời điểm in xong hoặc lỗi (ISO 8601 UTC). */
  completedAt?: string;
}

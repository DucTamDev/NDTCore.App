import type { PrinterFeatureException } from '../../exceptions';
import type { PrintTask } from './PrintTask';
import type { PrintTaskStatus } from './PrintTaskStatus';

/** Kết quả chạy một lệnh in. */
export interface PrintTaskResult {
  /** Lệnh in đã chạy. */
  task: PrintTask;

  /** In xong hay lỗi. */
  status: PrintTaskStatus;

  /** Lỗi khi in; chỉ có khi `status` là `Failed`. */
  error?: PrinterFeatureException;

  /** Thời điểm bắt đầu gửi tới máy in, sau khi tới lượt trong khoá (ISO 8601 UTC). */
  startedAt: string;

  /** Thời điểm in xong hoặc lỗi (ISO 8601 UTC). */
  completedAt: string;
}

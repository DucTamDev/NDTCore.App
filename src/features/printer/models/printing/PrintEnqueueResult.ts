import type { PrinterFeatureException } from '../../exceptions';
import type { PrintEnqueueStatus } from './PrintEnqueueStatus';
import type { PrintTask } from './PrintTask';

/** Kết quả một yêu cầu in: các lệnh đã vào hàng đợi, hoặc lý do không có lệnh nào. */
export interface PrintEnqueueResult {
  status: PrintEnqueueStatus;

  /** Lệnh đã vào hàng đợi, mỗi máy in nhận yêu cầu một lệnh; rỗng khi không `Queued`. */
  tasks: PrintTask[];

  /** `NO_AVAILABLE_PRINTER` hoặc `INVALID_IMAGE`; chỉ có khi không `Queued`. */
  error?: PrinterFeatureException;
}

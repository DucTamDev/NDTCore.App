import type { PrinterFeatureException } from '../../exceptions';
import type { PrintStatus } from './PrintStatus';
import type { PrintTask } from './PrintTask';

/** Kết quả một yêu cầu in: từng lệnh in và lỗi chung nếu có. */
export interface PrintResult {
  status: PrintStatus;

  /** Mỗi máy in nhận yêu cầu một lệnh in. */
  tasks: PrintTask[];

  error?: PrinterFeatureException;
}

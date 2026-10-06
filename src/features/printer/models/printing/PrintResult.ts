import type { PrinterFeatureException } from '../../exceptions';
import type { PrintResultStatus } from './PrintResultStatus';
import type { PrintTask } from './PrintTask';

/** Kết quả một yêu cầu in: từng lệnh in và lỗi chung nếu có. */
export interface PrintResult {
  status: PrintResultStatus;

  /** Mỗi máy in nhận yêu cầu một lệnh in. */
  tasks: PrintTask[];

  error?: PrinterFeatureException;
}

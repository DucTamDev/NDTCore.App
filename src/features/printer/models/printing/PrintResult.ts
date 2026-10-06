import type { PrinterFeatureException } from '../../exceptions';
import type { PrintStatus } from './PrintStatus';
import type { PrintTaskResult } from './PrintTaskResult';

/** Kết quả một yêu cầu in: từng lệnh in và lỗi chung nếu có. */
export interface PrintResult {
  status: PrintStatus;

  /** Kết quả từng lệnh in; mỗi máy in nhận yêu cầu một lệnh. */
  results: PrintTaskResult[];

  error?: PrinterFeatureException;
}

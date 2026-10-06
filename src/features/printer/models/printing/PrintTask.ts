import type { PrinterFeatureException } from '../../exceptions';
import type { PrintKind } from '../printer/PrintKind';
import type { PrintTaskStatus } from './PrintTaskStatus';

/** Một lệnh in gửi tới một máy in. */
export interface PrintTask {
  id: string;

  /** Các lệnh in sinh từ cùng một yêu cầu in (một yêu cầu có thể gửi tới nhiều máy) có chung `requestId`. */
  requestId: string;

  printerId: string;

  kind: PrintKind;

  /** Ảnh PNG base64 (không tiền tố `data:`) cần in. */
  image: string;

  status: PrintTaskStatus;

  retryCount: number;

  error?: PrinterFeatureException;

  /** ISO 8601 UTC. */
  createdAt: string;

  /** ISO 8601 UTC; có khi bắt đầu in. */
  startedAt?: string;

  /** ISO 8601 UTC; có khi in xong hoặc lỗi. */
  completedAt?: string;
}

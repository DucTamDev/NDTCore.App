import type { PrinterError } from '../../errors/PrinterError';
import type { PrintKind } from '../printer/PrintKind';
import type { PrintDocuments } from './PrintDocuments';

/** Trạng thái một lệnh in trong hàng đợi. */
export const PrintJobStatus = {
  Pending: 'Pending',
  Printing: 'Printing',
  Success: 'Success',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
} as const;

export type PrintJobStatus = (typeof PrintJobStatus)[keyof typeof PrintJobStatus];

/** Một lệnh in gửi tới một máy in. */
export interface PrintJob {
  id: string;

  /** Các lệnh in sinh từ cùng một yêu cầu in (một yêu cầu có thể gửi tới nhiều máy) có chung `requestId`. */
  requestId: string;

  printerId: string;

  kind: PrintKind;

  /** Gửi nguyên cả bản văn bản và bản ảnh; ngôn ngữ in tự chọn dùng bản nào. */
  documents: PrintDocuments;

  status: PrintJobStatus;

  retryCount: number;

  error?: PrinterError;

  /** ISO 8601 UTC. */
  createdAt: string;

  /** ISO 8601 UTC; có khi bắt đầu in. */
  startedAt?: string;

  /** ISO 8601 UTC; có khi in xong hoặc lỗi. */
  completedAt?: string;
}

/** Kết quả tổng của một yêu cầu in. */
export const PrintResultStatus = {
  Success: 'Success',
  PartialFailure: 'PartialFailure',
  Failed: 'Failed',
  NoAvailablePrinter: 'NoAvailablePrinter',
} as const;

export type PrintResultStatus = (typeof PrintResultStatus)[keyof typeof PrintResultStatus];

/** Kết quả một yêu cầu in: từng lệnh in và lỗi chung nếu có. */
export interface PrintResult {
  status: PrintResultStatus;

  jobs: PrintJob[];

  error?: PrinterError;
}

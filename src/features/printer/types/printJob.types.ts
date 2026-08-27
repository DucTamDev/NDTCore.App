import type { AppError } from './AppError';
import type { PrintDocumentVariants } from './driver.types';
import type { PrintType } from './printConfiguration.types';

export const PrintJobStatus = {
  pending: 'pending',
  printing: 'printing',
  success: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export type PrintJobStatus = (typeof PrintJobStatus)[keyof typeof PrintJobStatus];

export interface PrintJob {
  id: string;
  requestId: string;
  printerId: string;
  /** Loại nội dung (Hoá đơn/Tem) — TSPL driver dùng để chọn chế độ giấy liên tục (Receipt) hay dò khe (Label), xem `TsplDriver`. */
  printType: PrintType;
  /** Cả 2 variant (text/image) đi hết tới driver — driver tự chọn dùng cái nào (spec §7.2), KHÔNG resolve trước ở PrintService/PrintScheduler. */
  documentVariants: PrintDocumentVariants;
  status: PrintJobStatus;
  retryCount: number;
  error?: AppError;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type PrintResultStatus = 'success' | 'partial-failure' | 'failed' | 'no-available-printer';

export interface PrintResult {
  status: PrintResultStatus;
  jobs: PrintJob[];
  error?: AppError;
}

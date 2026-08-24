import type { AppError } from './AppError';
import type { PrintDocument } from './printDocument.types';
import type { PrintType } from './printConfiguration.types';

export type PrintJobStatus = 'pending' | 'printing' | 'success' | 'failed' | 'cancelled';

export interface PrintJob {
  id: string;
  requestId: string;
  printerId: string;
  /** Loại nội dung (Hoá đơn/Tem) — TSPL driver dùng để chọn chế độ giấy liên tục (Receipt) hay dò khe (Label), xem `TsplDriver`. */
  printType: PrintType;
  document: PrintDocument;
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

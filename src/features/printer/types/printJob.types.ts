import type { PrinterError } from './PrinterError';
import type { PrintDocuments } from './driver.types';
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
  /** TSPL driver dùng để chọn chế độ giấy liên tục (Receipt) hay dò khe (Label), xem `TsplDriver`. */
  printType: PrintType;
  /** Cả 2 variant (text/image) đi hết tới driver — driver tự chọn dùng cái nào (spec §7.2), KHÔNG resolve trước ở PrintService/PrintScheduler. */
  documents: PrintDocuments;
  status: PrintJobStatus;
  retryCount: number;
  error?: PrinterError;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export const PrintResultStatus = {
  success: 'success',
  partialFailure: 'partial-failure',
  failed: 'failed',
  noAvailablePrinter: 'no-available-printer',
} as const;

export type PrintResultStatus = (typeof PrintResultStatus)[keyof typeof PrintResultStatus];

export interface PrintResult {
  status: PrintResultStatus;
  jobs: PrintJob[];
  error?: PrinterError;
}

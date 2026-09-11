import type { PrinterError } from '../../errors/PrinterError';
import type { PrintDocuments } from '../../drivers/IPrinterDriver';
import type { PrintType } from './PrintType';

export const PrintJobStatus = {
  Pending: 'Pending',
  Printing: 'Printing',
  Success: 'Success',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
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
  Success: 'Success',
  PartialFailure: 'PartialFailure',
  Failed: 'Failed',
  NoAvailablePrinter: 'NoAvailablePrinter',
} as const;

export type PrintResultStatus = (typeof PrintResultStatus)[keyof typeof PrintResultStatus];

export interface PrintResult {
  status: PrintResultStatus;
  jobs: PrintJob[];
  error?: PrinterError;
}

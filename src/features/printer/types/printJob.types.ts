import type { AppError } from '../../../types/AppError';
import type { PrintDocument } from './printDocument.types';

export interface PrintPlan {
  id: string;
  destinationId: string;
  document: PrintDocument;
  copies: number;
}

export type PrintJobStatus = 'pending' | 'printing' | 'success' | 'failed' | 'cancelled';

export interface PrintJob {
  id: string;
  planId: string;
  printerId: string;
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

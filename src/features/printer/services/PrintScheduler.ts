import { AppErrorException, type AppError } from '../../../types/AppError';
import { PrinterService } from './PrinterService';
import type { PrintJob } from '../types/printJob.types';

interface QueueEntry {
  job: PrintJob;
  resolve: (job: PrintJob) => void;
}

type PrinterServiceLike = Pick<typeof PrinterService, 'print'>;

export const createPrintScheduler = (printerService: PrinterServiceLike) => {
  const queues = new Map<string, QueueEntry[]>();
  const processing = new Set<string>();

  const toAppError = (error: unknown): AppError =>
    error instanceof AppErrorException
      ? { code: error.code, message: error.message }
      : { code: 'PRINT_ERROR', message: String(error) };

  const processQueue = async (printerId: string): Promise<void> => {
    if (processing.has(printerId)) return;
    processing.add(printerId);
    try {
      const queue = queues.get(printerId);
      while (queue && queue.length > 0) {
        const entry = queue[0];
        const { job } = entry;
        job.status = 'printing';
        job.startedAt = new Date().toISOString();
        try {
          await printerService.print(job.printerId, job.document);
          job.status = 'success';
        } catch (error) {
          job.status = 'failed';
          job.error = toAppError(error);
        }
        job.completedAt = new Date().toISOString();
        queue.shift();
        entry.resolve(job);
      }
    } finally {
      processing.delete(printerId);
    }
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    new Promise<PrintJob>((resolve) => {
      if (!queues.has(job.printerId)) queues.set(job.printerId, []);
      queues.get(job.printerId)?.push({ job, resolve });
      void processQueue(job.printerId);
    });

  const retry = (job: PrintJob): Promise<PrintJob> => {
    job.retryCount += 1;
    job.status = 'pending';
    job.error = undefined;
    return enqueue(job);
  };

  return { enqueue, retry };
};

export const PrintScheduler = createPrintScheduler(PrinterService);

import { AppErrorException, type AppError } from '../../../types/AppError';
import { PrinterService } from './PrinterService';
import type { PrintJob } from '../types/printJob.types';

interface QueueEntry {
  job: PrintJob;
  resolve: (job: PrintJob) => void;
}

type PrinterServiceLike = Pick<typeof PrinterService, 'print' | 'getPrinters'>;

export const createPrintScheduler = (printerService: PrinterServiceLike) => {
  const queues = new Map<string, QueueEntry[]>();
  const processing = new Set<string>();

  const toAppError = (error: unknown): AppError =>
    error instanceof AppErrorException
      ? { code: error.code, message: error.message }
      : { code: 'PRINT_ERROR', message: String(error) };

  /**
   * Khoá tài nguyên dùng để tuần tự hoá job — theo `protocol`+`connectionType`
   * chứ không phải `printerId`, vì một số driver (vd `ThermalReceiptDriver`)
   * chỉ giữ được 1 kết nối native cho mỗi `connectionType` (giới hạn của thư
   * viện, không phải lỗi driver): 2 máy in cùng loại kết nối in song song có
   * thể khiến máy in sau "cướp" kết nối của máy in trước giữa chừng, làm mất
   * đơn in mà không có cảnh báo gì. Rơi về `printerId` nếu không tìm thấy
   * cấu hình máy in (không nên xảy ra trong thực tế).
   */
  const resourceKeyFor = (printerId: string): string => {
    const config = printerService.getPrinters().find((p) => p.id === printerId);
    return config ? `${config.protocol}:${config.connectionType}` : printerId;
  };

  const processQueue = async (resourceKey: string): Promise<void> => {
    if (processing.has(resourceKey)) return;
    processing.add(resourceKey);
    try {
      const queue = queues.get(resourceKey);
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
      processing.delete(resourceKey);
    }
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    new Promise<PrintJob>((resolve) => {
      const resourceKey = resourceKeyFor(job.printerId);
      if (!queues.has(resourceKey)) queues.set(resourceKey, []);
      queues.get(resourceKey)?.push({ job, resolve });
      void processQueue(resourceKey);
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

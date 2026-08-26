import { AppErrorException, type AppError } from '../types/AppError';
import { PrinterService } from './PrinterService';
import { PrinterConnectionLock, connectionResourceKey, type createResourceLock } from './PrinterConnectionLock';
import type { PrintJob } from '../types/printJob.types';

type PrinterServiceLike = Pick<typeof PrinterService, 'print' | 'getPrinters'>;
type ResourceLockLike = ReturnType<typeof createResourceLock>;

export const createPrintScheduler = (
  printerService: PrinterServiceLike,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const toAppError = (error: unknown): AppError =>
    error instanceof AppErrorException ? { code: error.code, message: error.message } : { code: 'PRINT_ERROR', message: String(error) };

  /**
   * Tra printer + driver sẽ xử lý `job.printType`, rồi tính resource key
   * theo đúng đặc thù driver đó (spec §9, xem `connectionResourceKey`) — KHÔNG
   * còn `protocol:connectionType` đơn giản như trước, vì mỗi driver type có
   * ranh giới concurrency khác nhau. Rơi về `job.printerId` nếu không tìm
   * thấy cấu hình (không nên xảy ra trong thực tế).
   */
  const resourceKeyFor = (job: PrintJob): string => {
    const printer = printerService.getPrinters().find((p) => p.id === job.printerId);
    if (!printer) return job.printerId;
    const driver = printer.drivers.find((d) => d.contentTypes.includes(job.printType)) ?? printer.drivers[0];
    return connectionResourceKey({ driverType: driver.type, connectionType: printer.connectionType, device: printer.device, lan: printer.lan });
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    lock
      .runExclusive(resourceKeyFor(job), async () => {
        job.status = 'printing';
        job.startedAt = new Date().toISOString();
        try {
          await printerService.print(job.printerId, job.documentVariants, job.printType);
          job.status = 'success';
        } catch (error) {
          job.status = 'failed';
          job.error = toAppError(error);
        }
        job.completedAt = new Date().toISOString();
      })
      .then(() => job);

  const retry = (job: PrintJob): Promise<PrintJob> => {
    job.retryCount += 1;
    job.status = 'pending';
    job.error = undefined;
    return enqueue(job);
  };

  return { enqueue, retry };
};

export const PrintScheduler = createPrintScheduler(PrinterService);

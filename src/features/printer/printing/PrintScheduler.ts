import { PrinterErrorException, PrinterErrorCode, type PrinterError } from '../errors/PrinterError';
import { PrinterPrintService } from './PrinterPrintService';
import { PrinterRepository } from '../storage/PrinterRepository';
import { PrinterConnectionLock, connectionResourceKey, type createResourceLock } from '../connection/PrinterConnectionLock';
import { PrintJobStatus, type PrintJob } from '../models/printing/PrintJob';

type PrintDispatchDeps = { print: typeof PrinterPrintService.print; getPrinters: typeof PrinterRepository.getPrinters };
type ResourceLockLike = ReturnType<typeof createResourceLock>;

export const createPrintScheduler = (
  printerService: PrintDispatchDeps,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const toPrinterError = (error: unknown): PrinterError =>
    error instanceof PrinterErrorException ? { code: error.code, message: error.message } : { code: PrinterErrorCode.UNKNOWN_ERROR, message: String(error) };

  /**
   * Tra printer sẽ xử lý `job.printerId`, rồi tính resource key theo đúng
   * đặc thù driver của printer đó (spec §9, xem `connectionResourceKey`) —
   * mỗi `Printer` giờ chỉ có đúng 1 driver nên không cần tìm driver nào khớp
   * `printType` nữa. Rơi về `job.printerId` nếu không tìm thấy cấu hình
   * (không nên xảy ra trong thực tế).
   */
  const resourceKeyFor = (job: PrintJob): string => {
    const printer = printerService.getPrinters().find((p) => p.id === job.printerId);

    if (!printer) {
      return job.printerId;
    }

    return connectionResourceKey({ driverType: printer.driver.type, connection: printer.connection });
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    lock
      .runExclusive(resourceKeyFor(job), async () => {
        job.status = PrintJobStatus.Printing;
        job.startedAt = new Date().toISOString();
        try {
          await printerService.print(job.printerId, job.documents);
          job.status = PrintJobStatus.Success;
        } catch (error) {
          job.status = PrintJobStatus.Failed;
          job.error = toPrinterError(error);
        }
        job.completedAt = new Date().toISOString();
      })
      .then(() => job);

  const retry = (job: PrintJob): Promise<PrintJob> => {
    job.retryCount += 1;
    job.status = PrintJobStatus.Pending;
    job.error = undefined;
    return enqueue(job);
  };

  return { enqueue, retry };
};

export const PrintScheduler = createPrintScheduler({
  print: PrinterPrintService.print,
  getPrinters: PrinterRepository.getPrinters,
});

import { PrinterErrorException, PrinterErrorCode, type PrinterError } from '../../errors/PrinterError';
import { PrinterConnectionService } from '../PrinterConnectionService';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { PrinterConnectionLock, connectionResourceKey, type createResourceLock } from '../connection/PrinterConnectionLock';
import { PrintJobStatus, type PrintJob } from '../../models/printing/PrintJob';

type PrintDispatchDeps = { print: typeof PrinterConnectionService.print; getPrinters: typeof PrinterRepository.getPrinters };
type ResourceLockLike = ReturnType<typeof createResourceLock>;

export const createPrintScheduler = (
  printerService: PrintDispatchDeps,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const toPrinterError = (error: unknown): PrinterError =>
    error instanceof PrinterErrorException ? { code: error.code, message: error.message } : { code: PrinterErrorCode.UNKNOWN_ERROR, message: String(error) };

  /**
   * Tra printer + driver sẽ xử lý `job.printType`, rồi tính resource key
   * theo đúng đặc thù driver đó (spec §9, xem `connectionResourceKey`) — KHÔNG
   * còn `protocol:connectionType` đơn giản như trước, vì mỗi driver type có
   * ranh giới concurrency khác nhau. Rơi về `job.printerId` nếu không tìm
   * thấy cấu hình (không nên xảy ra trong thực tế).
   */
  const resourceKeyFor = (job: PrintJob): string => {
    const printer = printerService.getPrinters().find((p) => p.id === job.printerId);

    if (!printer) {
      return job.printerId;
    }

    const driver = printer.drivers.find((d) => d.contentTypes.includes(job.printType)) ?? printer.drivers[0];
    return connectionResourceKey({ driverType: driver.type, connection: printer.connection });
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    lock
      .runExclusive(resourceKeyFor(job), async () => {
        job.status = PrintJobStatus.printing;
        job.startedAt = new Date().toISOString();
        try {
          await printerService.print(job.printerId, job.documents, job.printType);
          job.status = PrintJobStatus.success;
        } catch (error) {
          job.status = PrintJobStatus.failed;
          job.error = toPrinterError(error);
        }
        job.completedAt = new Date().toISOString();
      })
      .then(() => job);

  const retry = (job: PrintJob): Promise<PrintJob> => {
    job.retryCount += 1;
    job.status = PrintJobStatus.pending;
    job.error = undefined;
    return enqueue(job);
  };

  return { enqueue, retry };
};

export const PrintScheduler = createPrintScheduler({
  print: PrinterConnectionService.print,
  getPrinters: PrinterRepository.getPrinters,
});

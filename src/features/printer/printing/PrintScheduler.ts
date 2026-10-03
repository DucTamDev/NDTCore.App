import { PrinterErrorException, PrinterErrorCode, type PrinterError } from '../errors/PrinterError';
import { PrinterPrintService } from './PrinterPrintService';
import { PrinterRepository } from '../storage/PrinterRepository';
import { PrinterConnectionLock, lockKeyOf, type createResourceLock } from '../connection/PrinterConnectionLock';
import { PrintJobStatus, type PrintJob } from '../models/printing/PrintJob';

type PrintDispatchDeps = { print: typeof PrinterPrintService.print; getPrinters: typeof PrinterRepository.getPrinters };
type ResourceLockLike = ReturnType<typeof createResourceLock>;

export const createPrintScheduler = (
  printerService: PrintDispatchDeps,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const toPrinterError = (error: unknown): PrinterError =>
    error instanceof PrinterErrorException ? { code: error.code, message: error.message } : { code: PrinterErrorCode.UNKNOWN_ERROR, message: String(error) };

  /** Máy in không còn trong danh sách thì khoá theo `printerId` để các job của nó vẫn chạy lần lượt. */
  const lockKeyFor = (job: PrintJob): string => {
    const printer = printerService.getPrinters().find((candidate) => candidate.id === job.printerId);
    return printer ? lockKeyOf(printer) : job.printerId;
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    lock
      .runExclusive(lockKeyFor(job), async () => {
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

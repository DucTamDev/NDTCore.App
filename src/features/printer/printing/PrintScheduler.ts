import { toPrinterFeatureException } from '../exceptions';
import { printerPrintService, type PrinterPrintService } from './PrinterPrintService';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import { printerConnectionLock, lockKeyOf, type ResourceLock } from '../connection/PrinterConnectionLock';
import { PrintJobStatus, type PrintJob } from '../models/printing/PrintJob';

/** Phụ thuộc của hàng đợi in, tách ra để test thay được. */
export interface PrintSchedulerDeps {
  /** In một job trên máy của nó. */
  printing: PrinterPrintService;

  /** Danh sách máy in để tìm khoá theo máy vật lý của job. */
  repository: PrinterRepository;

  /** Khoá dùng chung với nút "In thử". */
  lock: ResourceLock;
}

/** Chạy job in theo thứ tự, mỗi máy vật lý một job tại một thời điểm. */
export class PrintScheduler {
  constructor(private readonly deps: PrintSchedulerDeps) {}

  enqueue(job: PrintJob): Promise<PrintJob> {
    return this.deps.lock.runExclusive(this.lockKeyFor(job), () => this.run(job)).then(() => job);
  }

  retry(job: PrintJob): Promise<PrintJob> {
    job.retryCount += 1;
    job.status = PrintJobStatus.Pending;
    job.error = undefined;
    return this.enqueue(job);
  }

  /** Máy in không còn trong danh sách thì khoá theo `printerId` để các job của nó vẫn chạy lần lượt. */
  private lockKeyFor(job: PrintJob): string {
    const printer = this.deps.repository.getPrinters().find((candidate) => candidate.id === job.printerId);
    return printer ? lockKeyOf(printer) : job.printerId;
  }

  private async run(job: PrintJob): Promise<void> {
    job.status = PrintJobStatus.Printing;
    job.startedAt = new Date().toISOString();

    try {
      await this.deps.printing.print(job.printerId, job.image);
      job.status = PrintJobStatus.Success;
    } catch (error) {
      job.status = PrintJobStatus.Failed;
      job.error = toPrinterFeatureException(error);
    }

    job.completedAt = new Date().toISOString();
  }
}

export const printScheduler = new PrintScheduler({
  printing: printerPrintService,
  repository: printerRepository,
  lock: printerConnectionLock,
});

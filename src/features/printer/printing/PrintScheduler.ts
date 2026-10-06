import { toPrinterFeatureException } from '../exceptions';
import { printerPrintService, type PrinterPrintService } from './PrinterPrintService';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import { printerConnectionLock, lockKeyOf, type ResourceLock } from '../connection/PrinterConnectionLock';
import { PrintTaskStatus } from '../models/printing/PrintTaskStatus';
import type { PrintTask } from '../models/printing/PrintTask';

/** Phụ thuộc của hàng đợi in, tách ra để test thay được. */
export interface PrintSchedulerDeps {
  /** In một lệnh in trên máy của nó. */
  printing: PrinterPrintService;

  /** Danh sách máy in để tìm khoá theo máy vật lý của lệnh in. */
  repository: PrinterRepository;

  /** Khoá dùng chung với nút "In thử". */
  lock: ResourceLock;
}

/** Chạy lệnh in theo thứ tự, mỗi máy vật lý một lệnh tại một thời điểm. */
export class PrintScheduler {
  constructor(private readonly deps: PrintSchedulerDeps) {}

  enqueue(task: PrintTask): Promise<PrintTask> {
    return this.deps.lock.runExclusive(this.lockKeyFor(task), () => this.run(task)).then(() => task);
  }

  retry(task: PrintTask): Promise<PrintTask> {
    task.retryCount += 1;
    task.status = PrintTaskStatus.Pending;
    task.error = undefined;
    return this.enqueue(task);
  }

  /** Máy in không còn trong danh sách thì khoá theo `printerId` để các lệnh in của nó vẫn chạy lần lượt. */
  private lockKeyFor(task: PrintTask): string {
    const printer = this.deps.repository.getPrinters().find((candidate) => candidate.id === task.printerId);
    return printer ? lockKeyOf(printer) : task.printerId;
  }

  private async run(task: PrintTask): Promise<void> {
    task.status = PrintTaskStatus.Printing;
    task.startedAt = new Date().toISOString();

    try {
      await this.deps.printing.print(task.printerId, task.image);
      task.status = PrintTaskStatus.Success;
    } catch (error) {
      task.status = PrintTaskStatus.Failed;
      task.error = toPrinterFeatureException(error);
    }

    task.completedAt = new Date().toISOString();
  }
}

export const printScheduler = new PrintScheduler({
  printing: printerPrintService,
  repository: printerRepository,
  lock: printerConnectionLock,
});

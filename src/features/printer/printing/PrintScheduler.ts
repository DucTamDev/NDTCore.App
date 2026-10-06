import { toPrinterFeatureException } from '../exceptions';
import { printerPrintService, type PrinterPrintService } from './PrinterPrintService';
import { printerConnectionLock, type ResourceLock } from '../connection/PrinterConnectionLock';
import { PrintTaskStatus } from '../models/printing/PrintTaskStatus';
import type { PrintTask } from '../models/printing/PrintTask';

/** Phụ thuộc của hàng đợi in, tách ra để test thay được. */
export interface PrintSchedulerDeps {
  /** In một lệnh in trên máy của nó. */
  printing: PrinterPrintService;

  /** Khoá dùng chung với nút "In thử". */
  lock: ResourceLock;
}

/** Chạy lệnh in theo thứ tự, mỗi máy vật lý một lệnh tại một thời điểm. */
export class PrintScheduler {
  constructor(private readonly deps: PrintSchedulerDeps) {}

  /** Khoá theo `task.deviceId`, trùng `lockKeyOf` của máy in đã lưu nên cùng khoá với nút "In thử". */
  enqueue(task: PrintTask): Promise<PrintTask> {
    return this.deps.lock.runExclusive(task.deviceId, () => this.run(task)).then(() => task);
  }

  retry(task: PrintTask): Promise<PrintTask> {
    task.retryCount += 1;
    task.status = PrintTaskStatus.Pending;
    task.error = undefined;
    return this.enqueue(task);
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
  lock: printerConnectionLock,
});

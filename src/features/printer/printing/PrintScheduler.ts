import { toPrinterFeatureException } from '../exceptions';
import { printerService, type PrinterService } from './PrinterService';
import { printerConnectionLock, type ResourceLock } from '../connection/PrinterConnectionLock';
import { PrintTaskStatus } from '../models/printing/PrintTaskStatus';
import type { PrintTask } from '../models/printing/PrintTask';

/** Chạy lệnh in theo thứ tự, mỗi máy vật lý một lệnh tại một thời điểm. */
export class PrintScheduler {
  constructor(
    /** In một lệnh in trên máy của nó. */
    private readonly printing: PrinterService = printerService,

    /** Khoá dùng chung với nút "In thử". */
    private readonly lock: ResourceLock = printerConnectionLock,
  ) {}

  /** Khoá theo `task.deviceId`, trùng `lockKeyOf` của máy in đã lưu nên cùng khoá với nút "In thử". */
  enqueue(task: PrintTask): Promise<PrintTask> {
    return this.lock.runExclusive(task.deviceId, () => this.run(task)).then(() => task);
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
      await this.printing.print(task.printerId, task.data);
      task.status = PrintTaskStatus.Success;
    } catch (error) {
      task.status = PrintTaskStatus.Failed;
      task.error = toPrinterFeatureException(error);
    }

    task.completedAt = new Date().toISOString();
  }
}

export const printScheduler = new PrintScheduler();

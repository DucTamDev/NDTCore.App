import { printerService, type PrinterService } from './PrinterService';
import { printerConnectionLock, type PrinterConnectionLock } from '../connection/PrinterConnectionLock';
import { toPrinterFeatureException, type PrinterFeatureException } from '../exceptions';
import { printerLogger } from '../logging/PrinterLogger';
import { PrintFailureKind, printFailureKindOf } from '../models/printing/PrintFailureKind';
import type { PrintTask } from '../models/printing/PrintTask';
import type { PrintTaskResult } from '../models/printing/PrintTaskResult';
import { PrintTaskStatus } from '../models/printing/PrintTaskStatus';
import { LoggerService } from '../../../services/LoggerService';

/** Thời gian chờ trước mỗi lần thử lại khi mở kết nối thất bại; hết danh sách là lỗi hẳn. */
export const PRINT_RETRY_DELAYS_MS: readonly number[] = [2000, 5000];

type TaskFinishedListener = (result: PrintTaskResult) => void;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const nowIso = (): string => new Date().toISOString();

/** Lỗi kết nối đã hết lượt thử lại hoặc máy không dùng được: lệnh sau của máy cũng sẽ lỗi y vậy. */
const failsWholeDevice = (error: PrinterFeatureException): boolean =>
  printFailureKindOf(error.code) !== PrintFailureKind.TaskFailed;

/**
 * Hàng đợi in theo máy vật lý: mỗi `deviceId` một hàng, in lần lượt đúng thứ tự; máy khác nhau in song song. Lệnh in
 * xong (thành công hoặc lỗi hẳn) bị xoá khỏi hàng ngay, kết quả báo qua `onTaskFinished`. Chỉ nằm trong bộ nhớ.
 */
export class PrintQueue {
  /** Lệnh chưa in xong theo `deviceId`; lệnh đầu hàng là lệnh đang in. */
  private readonly queues = new Map<string, PrintTask[]>();

  private readonly listeners = new Set<TaskFinishedListener>();

  constructor(
    /** In một lệnh trên máy của nó. */
    private readonly printing: PrinterService = printerService,

    /** Khoá theo máy vật lý, dùng chung với "In thử" và lệnh ngắt kết nối. */
    private readonly lock: PrinterConnectionLock = printerConnectionLock,
  ) {}

  /** Đưa lệnh vào cuối hàng của máy; không chờ in. */
  enqueue(task: PrintTask): void {
    const queue = this.queues.get(task.deviceId);

    if (queue) {
      queue.push(task);
      return;
    }

    this.queues.set(task.deviceId, [task]);
    this.runWorker(task.deviceId);
  }

  /** Nghe kết quả cuối của mỗi lệnh; trả hàm huỷ đăng ký. */
  onTaskFinished(listener: TaskFinishedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Xoá hàng ngay khi hết lệnh, không qua `await`, nên lệnh enqueue sau đó luôn mở worker mới. */
  private async runWorker(deviceId: string): Promise<void> {
    const queue = this.queues.get(deviceId) ?? [];

    while (queue.length > 0) {
      await this.printHead(queue);
    }

    this.queues.delete(deviceId);
  }

  private async printHead(queue: PrintTask[]): Promise<void> {
    const task = queue[0];
    const startedAt = nowIso();
    const error = await this.printWithRetry(task);

    if (!error) {
      queue.shift();
      this.emit({ task, status: PrintTaskStatus.Success, startedAt, completedAt: nowIso() });
      return;
    }

    const dropped = failsWholeDevice(error) ? queue.splice(0) : queue.splice(0, 1);
    const completedAt = nowIso();

    dropped.forEach((droppedTask) => {
      const droppedStartedAt = droppedTask === task ? startedAt : completedAt;
      this.emit({ task: droppedTask, status: PrintTaskStatus.Failed, error, startedAt: droppedStartedAt, completedAt });
    });
  }

  /** Chờ giữa các lần thử nằm ngoài khoá, để "In thử" và ngắt kết nối trên máy đó không bị chặn trong lúc chờ. */
  private async printWithRetry(task: PrintTask): Promise<PrinterFeatureException | undefined> {
    let attempt = 0;
    let error = await this.printOnce(task);

    while (error && this.canRetry(error, attempt)) {
      const delayMs = PRINT_RETRY_DELAYS_MS[attempt];
      attempt += 1;
      printerLogger.printRetryScheduled({ printerId: task.printerId, attempt, delayMs, errorCode: error.code });
      await delay(delayMs);
      error = await this.printOnce(task);
    }

    return error;
  }

  private canRetry(error: PrinterFeatureException, attempt: number): boolean {
    const isConnectFailure = printFailureKindOf(error.code) === PrintFailureKind.ConnectFailed;
    return isConnectFailure && attempt < PRINT_RETRY_DELAYS_MS.length;
  }

  private async printOnce(task: PrintTask): Promise<PrinterFeatureException | undefined> {
    try {
      await this.lock.runExclusive(task.deviceId, () => this.printing.print(task.printerId, task.data));
      return undefined;
    } catch (error) {
      return toPrinterFeatureException(error);
    }
  }

  /** Một listener hỏng không được làm dừng hàng đợi hay chặn các listener khác. */
  private emit(result: PrintTaskResult): void {
    this.listeners.forEach((listener) => {
      try {
        listener(result);
      } catch (error) {
        LoggerService.warning('PrintQueue.onTaskFinished listener failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }
}

export const printQueue = new PrintQueue();

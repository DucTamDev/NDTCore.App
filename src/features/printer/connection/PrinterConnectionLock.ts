import { deviceIdOf } from '../models/printer/PrinterConnection';
import type { Printer } from '../models/printer/Printer';
import { LoggerService } from '../../../services/LoggerService';

type Task = () => Promise<void>;

/**
 * Khoá theo máy vật lý: một lệnh in gồm nhiều lần gọi native, native chỉ giữ thứ tự từng lần gọi chứ không giữ trọn
 * cả lệnh in, nên hai lệnh in cùng một máy phải chạy lần lượt; máy khác nhau in song song. Tính từ kết nối để bản
 * nháp chưa lưu cũng có khoá đúng máy.
 */
export const lockKeyOf = (printer: Printer): string => deviceIdOf(printer.connection);

/**
 * Khoá loại trừ lẫn nhau theo key: mỗi key chỉ chạy một việc tại một thời điểm, việc sau xếp hàng. Lệnh in và nút
 * "In thử" dùng chung một khoá để không bao giờ chạm cùng một máy cùng lúc.
 */
export class PrinterConnectionLock {
  /** Việc đang chờ theo key; việc đầu hàng là việc đang chạy. */
  private readonly queues = new Map<string, Task[]>();

  /** Key đang có vòng xử lý hàng đợi, để không chạy hai vòng cho cùng một key. */
  private readonly processing = new Set<string>();

  runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.queues.has(key)) {
        this.queues.set(key, []);
      }

      this.queues.get(key)?.push(() => task().then(resolve, reject));
      // Mỗi task đã chuyển lỗi về promise ngoài nên nhánh này chỉ chạy khi chính hàng đợi hỏng.
      this.processQueue(key).catch((error: unknown) => {
        LoggerService.error('PrinterConnectionLock.processQueue', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });
  }

  private async processQueue(key: string): Promise<void> {
    if (this.processing.has(key)) {
      return;
    }

    this.processing.add(key);

    try {
      const queue = this.queues.get(key);

      while (queue && queue.length > 0) {
        await queue[0]();
        queue.shift();
      }
    } finally {
      this.queues.delete(key);
      this.processing.delete(key);
    }
  }
}

export const printerConnectionLock = new PrinterConnectionLock();

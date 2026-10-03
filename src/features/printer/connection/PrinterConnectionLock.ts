import { deviceIdOf } from '../models/printer/deviceIdOf';
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
 * Khoá loại trừ lẫn nhau theo key: mỗi key chỉ chạy một việc tại một thời điểm, việc sau xếp hàng. Hàng đợi in và
 * nút "In thử" dùng chung một khoá để không bao giờ chạm cùng một máy cùng lúc.
 */
export const createResourceLock = () => {
  const queues = new Map<string, Task[]>();
  const processing = new Set<string>();

  const processQueue = async (key: string): Promise<void> => {
    if (processing.has(key)) {
      return;
    }

    processing.add(key);

    try {
      const queue = queues.get(key);
      while (queue && queue.length > 0) {
        const task = queue[0];
        await task();
        queue.shift();
      }
    } finally {
      queues.delete(key);
      processing.delete(key);
    }
  };

  const runExclusive = <T>(key: string, task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (!queues.has(key)) {
        queues.set(key, []);
      }

      queues.get(key)?.push(() => task().then(resolve, reject));
      // Mỗi task đã chuyển lỗi về promise ngoài nên nhánh này chỉ chạy khi chính hàng đợi hỏng.
      processQueue(key).catch((error: unknown) => {
        LoggerService.error('PrinterConnectionLock.processQueue', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

  return { runExclusive };
};

export const PrinterConnectionLock = createResourceLock();

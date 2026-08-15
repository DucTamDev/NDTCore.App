// src/features/printer/services/PrinterConnectionLock.ts
import type { ConnectionType, Protocol } from '../types/printer.types';

type Task = () => Promise<void>;

/**
 * Khoá tài nguyên kết nối máy in — vd `"escpos:lan"` — định danh 1 kết nối
 * native dùng chung theo cặp protocol + connectionType (không phải theo
 * từng printerId), vì một số driver chỉ giữ được 1 kết nối native cho mỗi
 * connectionType.
 */
export const connectionResourceKey = (protocol: Protocol, connectionType: ConnectionType): string =>
  `${protocol}:${connectionType}`;

/**
 * Khoá loại trừ lẫn nhau theo resource key tuỳ ý, không biết gì về
 * PrintJob/PrinterConfig — dùng chung bởi `PrintScheduler` (hàng đợi in) và
 * `PrinterService.testPrint()` (thao tác thủ công "In thử"), để 2 đường gọi
 * này không bao giờ chạm cùng 1 kết nối native của driver cùng lúc (vd
 * `ThermalReceiptDriver` chỉ giữ được 1 kết nối / connectionType — máy in
 * thứ 2 connect() sẽ âm thầm ngắt máy in thứ 1 nếu chạy song song).
 */
export const createResourceLock = () => {
  const queues = new Map<string, Task[]>();
  const processing = new Set<string>();

  const processQueue = async (key: string): Promise<void> => {
    if (processing.has(key)) return;
    processing.add(key);
    try {
      const queue = queues.get(key);
      while (queue && queue.length > 0) {
        const task = queue[0];
        await task();
        queue.shift();
      }
    } finally {
      processing.delete(key);
    }
  };

  const runExclusive = <T>(key: string, task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (!queues.has(key)) queues.set(key, []);
      queues.get(key)?.push(() => task().then(resolve, reject));
      void processQueue(key);
    });

  return { runExclusive };
};

export const PrinterConnectionLock = createResourceLock();

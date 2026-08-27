import { PrinterDriverType } from '../types/printer.types';
import type { ConnectionType, PrinterDevice, PrinterLanConfig } from '../types/printer.types';

type Task = () => Promise<void>;

export interface ConnectionResourceKeyInput {
  driverType: PrinterDriverType;
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

/**
 * Resource key phải phản ánh đúng RANH GIỚI CONCURRENCY THẬT của lớp bên
 * dưới, không phải định danh vật lý của printer (spec §9, invariant #14):
 *
 * - USB: `RNUSBPrinter` là native module singleton dùng chung giữa CẢ 2
 *   driver — 1 key toàn cục `"usb"` bất kể protocol.
 * - ESC/POS qua Bluetooth/LAN: thư viện `@poriyaalar/...` giữ đúng 1 kết nối
 *   native / namespace, singleton TOÀN CỤC theo connectionType — KHÔNG theo
 *   device. Thu hẹp xuống per-device sẽ tái tạo lại bug multi-printer đã
 *   fix trước đây (2 job tưởng độc lập nhưng cướp kết nối lẫn nhau).
 * - TSPL qua Bluetooth/LAN: `TsplDriver` tự quản lý transport riêng theo
 *   printerId (không qua thư viện singleton) — an toàn để thu hẹp xuống
 *   per-connection, cho phép 2 máy TSPL khác nhau in song song thật.
 */
export const connectionResourceKey = (input: ConnectionResourceKeyInput): string => {
  if (input.connectionType === 'usb') return 'usb';
  if (input.driverType === PrinterDriverType.escpos) return `escpos:${input.connectionType}`;
  if (input.connectionType === 'bluetooth') {
    if (!input.device) throw new Error('Thiếu device để tính resource key cho TSPL qua Bluetooth');
    return `tspl:bluetooth:${input.device.deviceId}`;
  }
  if (!input.lan) throw new Error('Thiếu lan để tính resource key cho TSPL qua LAN');
  return `tspl:lan:${input.lan.ip}:${input.lan.port}`;
};

/**
 * Khoá loại trừ lẫn nhau theo resource key tuỳ ý — dùng chung bởi
 * `PrintScheduler` (hàng đợi in) và `PrinterService.testPrint()` (thao tác
 * thủ công "In thử"), để 2 đường gọi này không bao giờ chạm cùng 1 kết nối
 * native cùng lúc.
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
      queues.delete(key);
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

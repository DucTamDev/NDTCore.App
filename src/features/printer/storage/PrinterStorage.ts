import { StorageService } from '../../../services/StorageService';
import type { Printer } from '../types/printer.types';

const PRINTER_LIST_KEY = 'printer.list';
const PRINTER_DEFAULT_ID_KEY = 'printer.defaultId';
const PRINTER_STORAGE_VERSION_KEY = 'printer.storageVersion';

/**
 * Bump khi đổi cấu trúc `Printer` không tương thích ngược (spec §10) — dữ
 * liệu MMKV theo version cũ hơn/không có bị xoá hẳn (destructive reset),
 * KHÔNG migrate. Giá trị 1 tương ứng với model `drivers: PrinterDriver[]`
 * (thay cho `protocol` đơn) của lần refactor này.
 */
// v2: identityKey USB đổi sang ưu tiên `usb:serial:<serial>` (từ UsbDeviceInfoModule)
// — printer USB lưu theo v1 có key `usb:device:vid:pid` không còn khớp, reset.
const CURRENT_STORAGE_VERSION = 2;

/**
 * Xoá `printer.list`/`printer.defaultId` (key cũ, `isDefault` đã bị bỏ —
 * dọn nếu còn sót) và ghi `printer.storageVersion` mới trong CÙNG 1 lần gọi
 * — `StorageService` (MMKV) ghi đồng bộ nên 3 lệnh liên tiếp trong cùng hàm
 * là đủ atomic thực tế, không cần transaction thật (spec §10).
 */
const resetIfOutdated = (): void => {
  const storedVersion = StorageService.getItem<number>(PRINTER_STORAGE_VERSION_KEY) ?? 0;
  if (storedVersion === CURRENT_STORAGE_VERSION) return;
  StorageService.removeItem(PRINTER_LIST_KEY);
  StorageService.removeItem(PRINTER_DEFAULT_ID_KEY);
  StorageService.setItem(PRINTER_STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
};

export const PrinterStorage = {
  getPrinters(): Printer[] {
    resetIfOutdated();
    return StorageService.getItem<Printer[]>(PRINTER_LIST_KEY) ?? [];
  },

  savePrinters(printers: Printer[]): void {
    resetIfOutdated();
    StorageService.setItem(PRINTER_LIST_KEY, printers);
  },
};

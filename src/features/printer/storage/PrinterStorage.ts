import { StorageService } from '../../../services/StorageService';
import type { Printer } from '../models/printer/Printer';

const PRINTER_LIST_KEY = 'printer.list';

/** Key cũ (mặc định một máy in) không còn dùng; vẫn xoá khi reset cho sạch dữ liệu. */
const PRINTER_DEFAULT_ID_KEY = 'printer.defaultId';

const PRINTER_STORAGE_VERSION_KEY = 'printer.storageVersion';

/** Tăng khi đổi cấu trúc `Printer` mà dữ liệu cũ không đọc được; dữ liệu phiên bản khác bị xoá, không migrate. */
const CURRENT_STORAGE_VERSION = 8;

/** MMKV ghi đồng bộ nên ba lệnh liên tiếp đủ coi như một lần ghi, không cần transaction. */
const resetIfOutdated = (): void => {
  const storedVersion = StorageService.getItem<number>(PRINTER_STORAGE_VERSION_KEY) ?? 0;

  if (storedVersion === CURRENT_STORAGE_VERSION) {
    return;
  }

  StorageService.removeItem(PRINTER_LIST_KEY);
  StorageService.removeItem(PRINTER_DEFAULT_ID_KEY);
  StorageService.setItem(PRINTER_STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
};

/** Đọc/ghi danh sách máy in đã lưu. */
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

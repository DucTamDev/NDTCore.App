import { StorageService } from '../../../services/StorageService';
import type { Printer } from '../models/printer/Printer';

const PRINTER_LIST_KEY = 'printer.list';
const PRINTER_DEFAULT_ID_KEY = 'printer.defaultId';
const PRINTER_STORAGE_VERSION_KEY = 'printer.storageVersion';

/**
 * Bump khi đổi cấu trúc `Printer` không tương thích ngược (spec §10) — dữ
 * liệu MMKV theo version cũ hơn/không có bị xoá hẳn (destructive reset),
 * KHÔNG migrate. Giá trị 1 tương ứng với model `drivers: PrinterDriver[]`
 * (thay cho `protocol` đơn) của lần refactor này.
 */
// v3: identityKey USB = `usb:<vid>:<pid>[:<serial>]` (serial từ USBPrinter.getDeviceList()).
// Format đổi so với v1 (`usb:device:...`) và v2 (`usb:serial:...`) → reset.
// v4: bỏ Printer.paperSize + TsplDriverConfig.labelHeightMm, thay bằng
//     PrinterDriver.config.media (PrintPaperConfig) + Printer.capabilities.
//     Shape Printer đổi không tương thích ngược → reset (không migrate).
// v5: gộp Printer.connectionType/device/lan (3 field phẳng) thành
//     Printer.connection: { type, device, lan } (1 object lồng nhau) — shape
//     đổi không tương thích ngược → reset (không migrate).
// v6: Printer.connection đổi từ { type, device?, lan? } (field optional dùng
//     chung, cho phép trạng thái vô nghĩa) sang discriminated union theo
//     `type` — mỗi variant khai field phẳng riêng (`UsbPrinterConnection.vendorId/
//     productId/serialNumber`, `BluetoothPrinterConnection.deviceId/name`,
//     `LanPrinterConnection.host/port`, đổi tên `ip` → `host`) — shape đổi
//     không tương thích ngược → reset (không migrate), xem ARCHITECTURE.md §7.
// v7: Printer đổi từ "1 connection + drivers[] (1-2 phần tử, mỗi driver tự
//     giữ contentTypes/media riêng)" sang "1 connection + đúng 1 driver +
//     đúng 1 paper + đúng 1 type" (atomic per-PrintType config) — đồng thời
//     bỏ hẳn TsplDriverConfig.font/internalFont (TrueType/internal-font đã
//     xoá tính năng). Shape đổi không tương thích ngược → reset (không migrate),
//     xem ARCHITECTURE.md và spec 2026-09-11.
const CURRENT_STORAGE_VERSION = 7;

/**
 * Xoá `printer.list`/`printer.defaultId` (key cũ, `isDefault` đã bị bỏ —
 * dọn nếu còn sót) và ghi `printer.storageVersion` mới trong CÙNG 1 lần gọi
 * — `StorageService` (MMKV) ghi đồng bộ nên 3 lệnh liên tiếp trong cùng hàm
 * là đủ atomic thực tế, không cần transaction thật (spec §10).
 */
const resetIfOutdated = (): void => {
  const storedVersion = StorageService.getItem<number>(PRINTER_STORAGE_VERSION_KEY) ?? 0;

  if (storedVersion === CURRENT_STORAGE_VERSION) {
    return;
  }

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

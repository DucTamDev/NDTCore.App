import { useCallback, useEffect, useState } from 'react';
import { printerManager, type Printer, type PrinterManager, type UsbRebindCandidate } from '@ndtcore/printer';
import { LoggerService } from '../../../services/LoggerService';

/** Thao tác trên một máy in đã lưu; bó vào một object để không khoan từng callback qua các lớp component. */
export interface PrinterListActions {
  /** Xoá máy in; package huỷ phần in chưa xong và đóng kết nối khi không còn ai dùng. */
  removeAsync: (printerId: string) => Promise<void>;

  /** Kết nối lại, xin quyền nếu thiếu; kết quả báo qua trạng thái của máy. */
  reconnectAsync: (printerId: string) => Promise<void>;

  /** Máy USB đang cắm để chọn lại, kèm máy in khác đang dùng từng máy. */
  listUsbDevicesForRebind: (printerId: string) => UsbRebindCandidate[];

  /** Chọn lại máy USB theo path. */
  rebindUsbAsync: (printerId: string, path: string) => Promise<void>;
}

/** Danh sách máy in đã lưu kèm thao tác. */
export interface UsePrinterList extends PrinterListActions {
  /** Máy in đã lưu theo thứ tự thêm, kèm trạng thái kết nối. */
  printers: Printer[];
}

/** Danh sách máy in từ package, cập nhật khi danh sách hoặc trạng thái đổi. */
export const usePrinterList = (manager: PrinterManager = printerManager): UsePrinterList => {
  const [printers, setPrinters] = useState<Printer[]>(() => manager.getPrinters());

  useEffect(() => {
    setPrinters(manager.getPrinters());
    // Package báo cùng mảng khi chỉ trạng thái đổi; chép ra mảng mới để React vẽ lại.
    return manager.subscribe((list) => setPrinters([...list]));
  }, [manager]);

  const removeAsync = useCallback((printerId: string) => manager.removeAsync(printerId), [manager]);

  const reconnectAsync = useCallback(
    async (printerId: string) => {
      try {
        await manager.reconnectAsync(printerId);
      } catch (error) {
        LoggerService.warning('Kết nối lại máy in thất bại', { printerId, error });
      }
    },
    [manager],
  );

  const listUsbDevicesForRebind = useCallback(
    (printerId: string) => manager.listUsbDevicesForRebind(printerId),
    [manager],
  );

  const rebindUsbAsync = useCallback(
    (printerId: string, path: string) => manager.rebindUsbAsync(printerId, path),
    [manager],
  );

  return { printers, removeAsync, reconnectAsync, listUsbDevicesForRebind, rebindUsbAsync };
};

import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { LoggerService } from '../../../services/LoggerService';
import { PrinterService } from '../printing/PrinterService';
import { printersLoaded, printerRemoved, printerEnabledChanged, selectPrinters } from '../store/printerSlice';
import type { Printer } from '../types/printer.types';

/** Thao tác trên 1 máy in đã lưu — bó vào 1 object để không phải khoan 5 callback qua từng lớp component. */
export interface PrinterListActions {
  setEnabled: (printerId: string, enabled: boolean) => void;
  remove: (printerId: string) => void;
  connect: (printerId: string) => void;
  disconnect: (printerId: string) => Promise<void>;
  reconnect: (printerId: string) => void;
}

export interface UsePrinterList extends PrinterListActions {
  printers: Printer[];
  /** Nạp lại danh sách từ storage vào store — gọi sau khi modal Thêm/Sửa lưu xong. */
  reload: () => void;
}

/**
 * Nguồn đọc + ghi danh sách máy in cho tầng UI. Storage (MMKV qua
 * `PrinterService`) là nguồn sự thật; store Redux chỉ là bản cache để component
 * subscribe reactive — cùng mô hình `usePrinterConnection` dùng cho trạng thái
 * kết nối. Component KHÔNG tự gọi `PrinterService` để ghi: mọi mutation đi qua
 * hook này để storage và store luôn đồng bộ trong 1 bước.
 */
export const usePrinterList = (): UsePrinterList => {
  const dispatch = useDispatch<AppDispatch>();
  const printers = useSelector((state: RootState) => selectPrinters(state));

  const reload = useCallback(() => {
    const list = PrinterService.getPrinters();
    LoggerService.debug('usePrinterList.reload', {
      count: list.length,
      printers: list.map((p) => ({ id: p.id, name: p.name, connectionType: p.connectionType, drivers: p.drivers.map((d) => d.type), enabled: p.enabled ?? true })),
    });
    dispatch(printersLoaded(list));
  }, [dispatch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setEnabled = useCallback(
    (printerId: string, enabled: boolean) => {
      PrinterService.setEnabled(printerId, enabled);
      dispatch(printerEnabledChanged({ printerId, enabled }));
    },
    [dispatch],
  );

  const remove = useCallback(
    (printerId: string) => {
      PrinterService.removePrinter(printerId);
      dispatch(printerRemoved(printerId));
    },
    [dispatch],
  );

  const connect = useCallback((printerId: string) => {
    PrinterService.connect(printerId).catch(() => undefined);
  }, []);

  // `disconnect` trả Promise để card "Xoá khi đang kết nối" chờ ngắt xong mới xoá.
  const disconnect = useCallback((printerId: string) => PrinterService.disconnect(printerId).catch(() => undefined), []);

  const reconnect = useCallback((printerId: string) => {
    PrinterService.reconnect(printerId).catch(() => undefined);
  }, []);

  return { printers, reload, setEnabled, remove, connect, disconnect, reconnect };
};

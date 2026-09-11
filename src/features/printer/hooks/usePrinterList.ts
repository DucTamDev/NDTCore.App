import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { LoggerService } from '../../../services/LoggerService';
import { PrinterRepository } from '../storage/PrinterRepository';
import { PrinterConnectionService } from '../connection/PrinterConnectionService';
import { printersLoaded, printerRemoved, printerEnabledChanged, selectPrinters } from '../store/printerSlice';
import type { Printer } from '../models/printer/Printer';

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
 * `PrinterRepository`) là nguồn sự thật; store Redux chỉ là bản cache để component
 * subscribe reactive — cùng mô hình `usePrinterConnection` dùng cho trạng thái
 * kết nối. Component KHÔNG tự gọi `PrinterRepository` để ghi: mọi mutation đi qua
 * hook này để storage và store luôn đồng bộ trong 1 bước.
 */
export const usePrinterList = (): UsePrinterList => {
  const dispatch = useDispatch<AppDispatch>();
  const printers = useSelector((state: RootState) => selectPrinters(state));

  const reload = useCallback(() => {
    const list = PrinterRepository.getPrinters();
    LoggerService.debug('usePrinterList.reload', {
      count: list.length,
      printers: list.map((p) => ({ id: p.id, name: p.name, connectionType: p.connection.type, driver: p.driver.type, enabled: p.enabled ?? true })),
    });
    dispatch(printersLoaded(list));
  }, [dispatch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setEnabled = useCallback(
    (printerId: string, enabled: boolean) => {
      PrinterRepository.setEnabled(printerId, enabled);
      dispatch(printerEnabledChanged({ printerId, enabled }));
    },
    [dispatch],
  );

  const remove = useCallback(
    (printerId: string) => {
      PrinterRepository.removePrinter(printerId);
      dispatch(printerRemoved(printerId));
    },
    [dispatch],
  );

  const connect = useCallback((printerId: string) => {
    PrinterConnectionService.connect(printerId).catch(() => undefined);
  }, []);

  // `disconnect` trả Promise để card "Xoá khi đang kết nối" chờ ngắt xong mới xoá.
  const disconnect = useCallback((printerId: string) => PrinterConnectionService.disconnect(printerId).catch(() => undefined), []);

  const reconnect = useCallback((printerId: string) => {
    PrinterConnectionService.reconnect(printerId).catch(() => undefined);
  }, []);

  return { printers, reload, setEnabled, remove, connect, disconnect, reconnect };
};

import type { IPrinterDriver, Unsubscribe } from '../drivers/IPrinterDriver';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { Printer } from '../models/printer/Printer';
import { DriverRegistry } from '../drivers/DriverRegistry';
import { PrinterConnectionLock, resourceKeyFor, type createResourceLock } from './PrinterConnectionLock';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type ResourceLockLike = ReturnType<typeof createResourceLock>;
type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Connection lifecycle trên máy in ĐÃ LƯU và draft chưa lưu — mọi lệnh đụng
 * kết nối native chạy qua `lock` để không interleave trên cùng resource. Print
 * dispatch (`print`/`testPrint`) nằm ở `PrinterPrintService` (anh em cùng
 * cấp), không phải service này.
 */
export const createPrinterConnectionService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
  repository: PrinterRepositoryLike = PrinterRepository,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];

  const connect = async (printerId: string): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    await lock.runExclusive(resourceKeyFor(printer), () => getDriver(printer.driver.type).connect(printer));
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    await lock.runExclusive(resourceKeyFor(printer), () => getDriver(printer.driver.type).disconnect(printerId));
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(printerId);
  };

  const reconnectAutoPrinters = (): void => {
    repository
      .getPrinters()
      .filter((p) => p.enabled && p.autoReconnect)
      .forEach((p) => {
        connect(p.id).catch(() => undefined);
      });
  };

  const connectDraft = async (printer: Printer): Promise<void> => {
    await getDriver(printer.driver.type).connect(printer);
  };

  const disconnectForDriver = async (type: PrinterDriverType, printerId: string): Promise<void> => {
    await getDriver(type).disconnect(printerId);
  };

  const getStatus = (printerId: string): PrinterStatus => {
    const printer = repository.findOrThrow(printerId);
    return getDriver(printer.driver.type).getStatus(printerId);
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const printer = repository.findOrThrow(printerId);
    return getDriver(printer.driver.type).onStatusChange(printerId, callback);
  };

  /**
   * Bypass repository — cho draft CHƯA LƯU trong `useAddPrinterFlow` (printer
   * chưa có trong storage nên `getStatus`/`onStatusChange` ở trên sẽ throw
   * `PRINTER_NOT_FOUND`). Vẫn giữ ở bản atomic-driver này vì lý do tồn tại
   * không phải multi-driver dedup mà là "printer chưa tồn tại trong storage".
   */
  const getStatusForDriver = (type: PrinterDriverType, printerId: string): PrinterStatus => getDriver(type).getStatus(printerId);

  const onStatusChangeForDriver = (type: PrinterDriverType, printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe =>
    getDriver(type).onStatusChange(printerId, callback);

  return {
    connect,
    disconnect,
    reconnect,
    reconnectAutoPrinters,
    connectDraft,
    disconnectForDriver,
    getStatus,
    onStatusChange,
    getStatusForDriver,
    onStatusChangeForDriver,
  };
};

export const PrinterConnectionService = createPrinterConnectionService(DriverRegistry, PrinterRepository, PrinterConnectionLock);

import type { IPrinterDriver, Unsubscribe } from '../drivers/IPrinterDriver';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { Printer } from '../models/printer/Printer';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import { DriverRegistry } from '../drivers/DriverRegistry';
import { PrinterConnectionLock, resourceKeyFor, type createResourceLock } from './PrinterConnectionLock';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type ResourceLockLike = ReturnType<typeof createResourceLock>;
type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Connection lifecycle trên máy in ĐÃ LƯU và draft chưa lưu — mọi lệnh đụng
 * kết nối native chạy qua `lock` để không interleave trên cùng resource. Print
 * dispatch (`print`/`testPrint`) nằm ở `PrinterPrintService` (anh em cùng
 * cấp, không phải service này) — xem `printing/PrinterPrintService.ts`.
 *
 * Connection lifecycle for saved printers and unsaved drafts — every command
 * touching a native connection runs through `lock` so calls never interleave
 * on the same resource. Print dispatch lives in the sibling
 * `PrinterPrintService`, not here.
 */
export const createPrinterConnectionService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
  repository: PrinterRepositoryLike = PrinterRepository,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];

  /**
   * Kết nối TẤT CẢ driver của printer, qua khoá tài nguyên riêng cho từng
   * driver — 1 driver lỗi không chặn driver còn lại (`Promise.allSettled`).
   * LAN/Bluetooth: mỗi driver là 1 kết nối native độc lập. USB: cả 2 driver
   * dùng chung 1 channel — connect driver B sau khi A đã sống sẽ "cướp" kênh
   * (giới hạn đã biết của thư viện, không giải quyết ở đây).
   */
  const connect = async (printerId: string): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    await Promise.allSettled(
      printer.drivers.map((driver) =>
        lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).connect(printer, driver)),
      ),
    );
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    await Promise.allSettled(
      printer.drivers.map((driver) =>
        lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).disconnect(printerId)),
      ),
    );
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

  const connectDraft = async (printer: Printer, driver: PrinterDriver): Promise<void> => {
    await getDriver(driver.type).connect(printer, driver);
  };

  const disconnectForDriver = async (type: PrinterDriverType, printerId: string): Promise<void> => {
    await getDriver(type).disconnect(printerId);
  };

  /** Connected nếu BẤT KỲ driver nào của printer đang connected, ngược lại fallback driver đầu tiên — 1 badge/1 printer dù có thể có 2 driver. */
  const getStatus = (printerId: string): PrinterStatus => {
    const printer = repository.findOrThrow(printerId);
    const statuses = printer.drivers.map((d) => getDriver(d.type).getStatus(printerId));
    return statuses.find((s) => s === PrinterStatus.Connected) ?? statuses[0] ?? PrinterStatus.Idle;
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const printer = repository.findOrThrow(printerId);
    const unsubscribes = printer.drivers.map((d) => getDriver(d.type).onStatusChange(printerId, () => callback(getStatus(printerId))));
    return () => unsubscribes.forEach((unsub) => unsub());
  };

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

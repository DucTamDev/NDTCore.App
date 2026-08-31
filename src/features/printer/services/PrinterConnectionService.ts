import type { IPrinterDriver, PrintDocuments, PrintOptions, Unsubscribe } from '../drivers/IPrinterDriver';
import { PrinterDriverType, PrinterStatus } from '../types/printer.types';
import type { Printer, PrinterDriver } from '../types/printer.types';
import type { PrintType } from '../models/printing/PrintType';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';
import { DriverRegistry } from '../drivers/DriverRegistry';
import { PrinterConnectionLock, resourceKeyFor, type createResourceLock } from './PrinterConnectionLock';
import { PrinterRepository, type createPrinterRepository } from './PrinterRepository';

type ResourceLockLike = ReturnType<typeof createResourceLock>;
type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Các thao tác kết nối/in trên máy in ĐÃ LƯU và draft chưa lưu — mọi lệnh
 * đụng kết nối native chạy qua `lock` để không interleave trên cùng resource.
 *
 * Connection/print operations on saved printers and unsaved drafts — every
 * command touching a native connection runs through `lock` so calls never
 * interleave on the same resource.
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

  const testPrint = async (printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void> => {
    await lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).testPrint(printer, driver, documents, printType, options));
  };

  const print = async (printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    const driverEntry = printer.drivers.find((d) => d.contentTypes.includes(printType));
    if (!driverEntry) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.NO_AVAILABLE_PRINTER,
        message: `Máy in ${printerId} không có driver nào nhận in ${printType}`,
      });
    }
    const driver = getDriver(driverEntry.type);
    if (driver.getStatus(printerId) !== PrinterStatus.connected) {
      await driver.connect(printer, driverEntry);
    }
    await driver.print(printerId, documents, printType);
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
    return statuses.find((s) => s === PrinterStatus.connected) ?? statuses[0] ?? PrinterStatus.idle;
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
    testPrint,
    print,
    connectDraft,
    disconnectForDriver,
    getStatus,
    onStatusChange,
    getStatusForDriver,
    onStatusChangeForDriver,
  };
};

export const PrinterConnectionService = createPrinterConnectionService(DriverRegistry, PrinterRepository, PrinterConnectionLock);

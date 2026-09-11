import type { IPrinterDriver, PrintDocuments, PrintOptions } from '../drivers/IPrinterDriver';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { Printer } from '../models/printer/Printer';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import type { PrintType } from '../models/printing/PrintType';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';
import { DriverRegistry } from '../drivers/DriverRegistry';
import { PrinterConnectionLock, resourceKeyFor, type createResourceLock } from '../connection/PrinterConnectionLock';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type ResourceLockLike = ReturnType<typeof createResourceLock>;
type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Thực thi print/test-print cho 1 printer cụ thể — tách khỏi
 * `PrinterConnectionService` (chỉ còn connection lifecycle) vì đây là 1
 * trách nhiệm khác: dùng driver ĐÃ/SẮP connect để in, không quản lý connection
 * state (ARCHITECTURE.md §26 `PrinterPrintService`).
 *
 * Anh em cùng cấp với `PrinterConnectionService`, KHÔNG phải wrapper quanh nó
 * — `print()` gọi `driver.connect()` trực tiếp khi cần (không qua
 * `PrinterConnectionService.connect()`), nên chỉ cần chung `registry`/
 * `repository`/`lock`, không phụ thuộc method nào của
 * `PrinterConnectionService`.
 */
export const createPrinterPrintService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
  repository: PrinterRepositoryLike = PrinterRepository,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];

  /**
   * KHÔNG tự `lock.runExclusive` — luôn được `PrintScheduler.enqueue()` gọi
   * từ BÊN TRONG 1 `lock.runExclusive` đã acquire sẵn ở tầng scheduler cùng
   * `resourceKey`. `PrinterConnectionLock` không reentrant: nếu thêm lock ở
   * đây "cho nhất quán với `testPrint()`" sẽ deadlock ngay lập tức vì lồng
   * bên trong lock cùng key mà scheduler đang giữ. `testPrint()` tự lock vì
   * được UI gọi thẳng, không qua scheduler.
   */
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

    if (driver.getStatus(printerId) !== PrinterStatus.Connected) {
      await driver.connect(printer, driverEntry);
    }

    await driver.print(printerId, documents, printType);
  };

  const testPrint = async (printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void> => {
    await lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).testPrint(printer, driver, documents, printType, options));
  };

  return { print, testPrint };
};

export const PrinterPrintService = createPrinterPrintService(DriverRegistry, PrinterRepository, PrinterConnectionLock);

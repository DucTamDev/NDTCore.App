import type { IPrinterDriver, PrintDocuments, PrintOptions } from '../drivers/IPrinterDriver';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { Printer } from '../models/printer/Printer';
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
   * `resourceKey`. `testPrint()` tự lock vì được UI gọi thẳng, không qua scheduler.
   */
  const print = async (printerId: string, documents: PrintDocuments, options?: PrintOptions): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    const driver = getDriver(printer.driver.type);

    if (driver.getStatus(printerId) !== PrinterStatus.Connected) {
      await driver.connect(printer);
    }

    await driver.print(printerId, documents, options);
  };

  const testPrint = async (printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void> => {
    await lock.runExclusive(resourceKeyFor(printer), () => getDriver(printer.driver.type).testPrint(printer, documents, options));
  };

  return { print, testPrint };
};

export const PrinterPrintService = createPrinterPrintService(DriverRegistry, PrinterRepository, PrinterConnectionLock);

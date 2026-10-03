import type { PrintDocuments } from '../models/printing/PrintDocuments';
import type { PrintOptions } from '../models/printing/PrintOptions';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { Printer } from '../models/printer/Printer';
import { errorCodeOf } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { getPrintLanguage } from '../languages/getPrintLanguage';
import { PrinterConnectionService } from '../connection/PrinterConnectionService';
import { PrinterConnectionLock, lockKeyOf, type createResourceLock } from '../connection/PrinterConnectionLock';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type ResourceLockLike = ReturnType<typeof createResourceLock>;

type PrinterRepositoryLike = Pick<ReturnType<typeof createPrinterRepository>, 'findOrThrow'>;

type ConnectionServiceLike = Pick<typeof PrinterConnectionService, 'connect' | 'getStatus' | 'send'>;

/** In nội dung ra một máy in: encode theo ngôn ngữ của máy rồi gửi qua kết nối của máy. */
export const createPrinterPrintService = (
  connectionService: ConnectionServiceLike = PrinterConnectionService,
  repository: PrinterRepositoryLike = PrinterRepository,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const sendDocuments = async (printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void> => {
    if (connectionService.getStatus(printer.id) !== PrinterStatus.Connected) {
      await connectionService.connect(printer);
    }

    const bytes = getPrintLanguage(printer.language.type).encode(printer, documents, options);
    await connectionService.send(printer.id, bytes);
  };

  /** Không tự khoá: `PrintScheduler` gọi hàm này bên trong khoá của chính máy đó, khoá lại sẽ treo. */
  const print = async (printerId: string, documents: PrintDocuments, options?: PrintOptions): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    const language = printer.language.type;
    const startedAt = Date.now();

    try {
      await sendDocuments(printer, documents, options);
      PrinterLogger.printSucceeded({ printerId, language, durationMs: Date.now() - startedAt });
    } catch (error) {
      const errorCode = errorCodeOf(error);
      PrinterLogger.printFailed({ printerId, language, errorCode, durationMs: Date.now() - startedAt });
      throw error;
    }
  };

  /** Máy in có thể chưa lưu (đang thêm máy); tự khoá vì UI gọi thẳng, không qua hàng đợi. */
  const testPrint = (printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void> =>
    lock.runExclusive(lockKeyOf(printer), async () => {
      const printerId = printer.id;
      const language = printer.language.type;
      const startedAt = Date.now();

      try {
        await sendDocuments(printer, documents, options);
        PrinterLogger.testPrintSucceeded({ printerId, language, durationMs: Date.now() - startedAt });
      } catch (error) {
        const errorCode = errorCodeOf(error);
        PrinterLogger.testPrintFailed({ printerId, language, errorCode, durationMs: Date.now() - startedAt });
        throw error;
      }
    });

  return { print, testPrint };
};

export const PrinterPrintService = createPrinterPrintService();

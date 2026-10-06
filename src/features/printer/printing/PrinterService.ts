import type { PrintOptions } from '../models/printing/PrintOptions';
import { ConnectionStatus } from '../models/connections/ConnectionStatus';
import type { Printer } from '../models/printer/Printer';
import { errorCodeOf, PrinterErrorException } from '../exceptions';
import { PrinterErrorCode } from '../errors';
import { printerLogger } from '../logging/PrinterLogger';
import { getPrintLanguage } from '../languages';
import { printerConnectionService, type PrinterConnectionService } from '../connection/PrinterConnectionService';
import { printerConnectionLock, lockKeyOf, type PrinterConnectionLock } from '../connection/PrinterConnectionLock';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';

/** In ảnh ra một máy in: encode theo ngôn ngữ của máy rồi gửi qua kết nối của máy. */
export class PrinterService {
  constructor(
    private readonly connectionService: PrinterConnectionService =
      printerConnectionService,
    private readonly repository: PrinterRepository = printerRepository,
    private readonly lock: PrinterConnectionLock = printerConnectionLock,
  ) {}

  /** Không tự khoá: `PrintService` gọi hàm này bên trong khoá của chính máy đó, khoá lại sẽ treo. */
  async print(printerId: string, image: string, options?: PrintOptions): Promise<void> {
    const printer = this.repository.findById(printerId);

    if (!printer) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.PRINTER_NOT_FOUND,
        message: `Không tìm thấy máy in với id ${printerId}`,
      });
    }

    const language = printer.language.type;
    const startedAt = Date.now();

    try {
      await this.send(printer, image, options);
      printerLogger.printSucceeded({ printerId, language, durationMs: Date.now() - startedAt });
    } catch (error) {
      const errorCode = errorCodeOf(error);
      printerLogger.printFailed({ printerId, language, errorCode, durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  /** Máy in có thể chưa lưu (đang thêm máy); tự khoá vì UI gọi thẳng, không qua hàng đợi. */
  testPrint(printer: Printer, image: string, options?: PrintOptions): Promise<void> {
    return this.lock.runExclusive(lockKeyOf(printer), async () => {
      const printerId = printer.id;
      const language = printer.language.type;
      const startedAt = Date.now();

      try {
        await this.send(printer, image, options);
        printerLogger.testPrintSucceeded({ printerId, language, durationMs: Date.now() - startedAt });
      } catch (error) {
        const errorCode = errorCodeOf(error);
        printerLogger.testPrintFailed({ printerId, language, errorCode, durationMs: Date.now() - startedAt });
        throw error;
      }
    });
  }

  private async send(printer: Printer, image: string, options?: PrintOptions): Promise<void> {
    if (this.connectionService.getStatus(printer.id) !== ConnectionStatus.Connected) {
      await this.connectionService.connect(printer);
    }

    const bytes = getPrintLanguage(printer.language.type).encode(printer, image, options);
    await this.connectionService.send(printer.id, bytes);
  }
}

export const printerService = new PrinterService();

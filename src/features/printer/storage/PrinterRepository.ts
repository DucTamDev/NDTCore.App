import type { Printer } from '../models/printer/Printer';
import { PrinterErrorException } from '../exceptions';
import { PrinterErrorCode } from '../errors';
import { printerStorage, type PrinterStorage } from './PrinterStorage';
import { printerSchema } from '../forms/addPrinter/PrinterSchema';

/**
 * Kho lưu trữ máy in — bọc `PrinterStorage` và chống trùng (`deviceId`, `kind`). `deviceId` do native trả lúc kết nối,
 * repository không tự tính. Không phụ thuộc kết nối hay khoá in.
 */
export class PrinterRepository {
  constructor(private readonly storage: PrinterStorage = printerStorage) {}

  getPrinters(): Printer[] {
    return this.storage.getPrinters();
  }

  savePrinters(printers: Printer[]): void {
    this.storage.savePrinters(printers);
  }

  /** `undefined` khi không có máy in `printerId` (vd đã bị xoá); nơi gọi tự quyết định xử lý. */
  findById(printerId: string): Printer | undefined {
    return this.getPrinters().find((printer) => printer.id === printerId);
  }

  addPrinter(printer: Printer): void {
    const withIdentity = this.validated(printer);
    this.savePrinters([...this.getPrinters(), withIdentity]);
  }

  updatePrinter(printer: Printer): void {
    const withIdentity = this.validated(printer);
    this.savePrinters(this.getPrinters().map((saved) => (saved.id === withIdentity.id ? withIdentity : saved)));
  }

  removePrinter(printerId: string): void {
    this.savePrinters(this.getPrinters().filter((printer) => printer.id !== printerId));
  }

  setEnabled(printerId: string, enabled: boolean): void {
    const printers = this.getPrinters();
    this.savePrinters(printers.map((printer) => (printer.id === printerId ? { ...printer, enabled } : printer)));
  }

  /**
   * Kiểm tra schema rồi chống trùng (`deviceId`, `kind`) — lưới an toàn ở tầng lưu, UI đã tự kiểm sau khi kết nối.
   */
  private validated(printer: Printer): Printer {
    printerSchema.parse(printer);
    this.assertNoDuplicateIdentity(printer);
    return printer;
  }

  private assertNoDuplicateIdentity(printer: Printer): void {
    const collision = this.getPrinters().find(
      (saved) => saved.id !== printer.id && saved.deviceId === printer.deviceId && saved.kind === printer.kind,
    );

    if (collision) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.PRINTER_ALREADY_EXISTS,
        message: `Máy in này đã được thêm cho loại nội dung này với tên "${collision.name}".`,
      });
    }
  }
}

export const printerRepository = new PrinterRepository();

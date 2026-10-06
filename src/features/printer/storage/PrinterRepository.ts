import type { Printer } from '../models/printer/Printer';
import { PrinterErrorException } from '../exceptions';
import { PrinterErrorCode } from '../errors';
import { printerStorage, type PrinterStorage } from './PrinterStorage';
import { deviceIdOf } from '../models/device/DeviceAddress';
import { printerSchema } from '../forms/addPrinter/PrinterSchema';
import type { PrinterWriteInput } from './PrinterWriteInput';

/**
 * Kho lưu trữ máy in — bọc `PrinterStorage` và các bất biến về định danh
 * (`deviceId` tính lại + chống trùng). Không phụ thuộc kết nối hay khoá in.
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

  addPrinter(printer: PrinterWriteInput): void {
    const withIdentity = this.validated(printer);
    this.savePrinters([...this.getPrinters(), withIdentity]);
  }

  updatePrinter(printer: PrinterWriteInput): void {
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
   * Tính lại `deviceId` từ chính `printer.connection` (không tin giá trị nơi gọi truyền vào), kiểm tra schema rồi
   * chống trùng (`deviceId`, `kind`) — lưới an toàn ở tầng lưu, UI đã tự kiểm trước.
   */
  private validated(printer: PrinterWriteInput): Printer {
    const withIdentity: Printer = { ...printer, deviceId: deviceIdOf(printer.connection) };
    printerSchema.parse(withIdentity);
    this.assertNoDuplicateIdentity(withIdentity);
    return withIdentity;
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

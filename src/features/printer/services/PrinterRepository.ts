import type { Printer } from '../types/printer.types';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';
import { PrinterStorage } from '../storage/PrinterStorage';
import { resolveIdentityKey } from './discovery/PrinterResolver';
import { printerSchema } from '../schemas/printerFormSchema';

/**
 * Kho lưu trữ máy in — bọc `PrinterStorage` và các bất biến về định danh
 * (`identityKey` tính lại + chống trùng). Không phụ thuộc driver/lock.
 *
 * Printer repository — wraps `PrinterStorage` plus the identity invariants
 * (recomputed `identityKey` + duplicate guard). No driver/lock dependency.
 */
export const createPrinterRepository = () => {
  const getPrinters = (): Printer[] => PrinterStorage.getPrinters();
  const savePrinters = (printers: Printer[]): void => PrinterStorage.savePrinters(printers);

  const findOrThrow = (printerId: string): Printer => {
    const found = getPrinters().find((p) => p.id === printerId);
    if (!found) throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_FOUND, message: `Không tìm thấy máy in với id ${printerId}` });
    return found;
  };

  const assertNoDuplicateIdentity = (printer: Printer): void => {
    const collision = getPrinters().find((p) => p.id !== printer.id && p.identityKey === printer.identityKey);
    if (collision) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.PRINTER_ALREADY_EXISTS,
        message: `Máy in này đã được thêm với tên "${collision.name}" — dùng "+ Thêm driver" trên máy in đó thay vì thêm mới.`,
      });
    }
  };

  /**
   * Tính lại `identityKey` từ chính `connectionType`/`device`/`lan` của
   * printer — KHÔNG tin thẳng giá trị caller truyền vào (defense-in-depth,
   * cùng triết lý với `printerSchema.parse()` bên dưới: UI đã tự tính đúng,
   * đây là lưới an toàn ở service layer, không phải nguồn sự thật duy nhất).
   */
  const withRecomputedIdentity = (printer: Printer): Printer => ({
    ...printer,
    identityKey: resolveIdentityKey({ connectionType: printer.connectionType, device: printer.device, lan: printer.lan }),
  });

  const addPrinter = (printer: Printer): void => {
    const withIdentity = withRecomputedIdentity(printer);
    printerSchema.parse(withIdentity);
    assertNoDuplicateIdentity(withIdentity);
    savePrinters([...getPrinters(), withIdentity]);
  };

  const updatePrinter = (printer: Printer): void => {
    const withIdentity = withRecomputedIdentity(printer);
    printerSchema.parse(withIdentity);
    assertNoDuplicateIdentity(withIdentity);
    savePrinters(getPrinters().map((p) => (p.id === withIdentity.id ? withIdentity : p)));
  };

  const removePrinter = (printerId: string): void => {
    savePrinters(getPrinters().filter((p) => p.id !== printerId));
  };

  const setEnabled = (printerId: string, enabled: boolean): void => {
    savePrinters(getPrinters().map((p) => (p.id === printerId ? { ...p, enabled } : p)));
  };

  return { getPrinters, savePrinters, findOrThrow, addPrinter, updatePrinter, removePrinter, setEnabled };
};

export const PrinterRepository = createPrinterRepository();

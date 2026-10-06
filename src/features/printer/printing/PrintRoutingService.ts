import type { PrintKind } from '../models/printer/PrintKind';
import type { Printer } from '../models/printer/Printer';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';

/** Xác định các máy in được cấu hình để xử lý một loại nội dung in. */
export class PrintRoutingService {
  constructor(private readonly repository: PrinterRepository = printerRepository) {}

  resolveTargets(kind: PrintKind): Printer[] {
    return this.repository.getPrinters().filter((printer) => printer.enabled && printer.kind === kind);
  }
}

export const printRoutingService = new PrintRoutingService();

import type { PrintKind } from '../models/printer/PrintKind';
import type { Printer } from '../models/printer/Printer';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';

/** CHỈ biết "loại nội dung nào → máy in nào": mỗi `Printer` in đúng một `kind`. */
export class PrintRoutingService {
  constructor(private readonly repository: PrinterRepository = printerRepository) {}

  resolveTargets(kind: PrintKind): Printer[] {
    return this.repository.getPrinters().filter((printer) => printer.enabled && printer.kind === kind);
  }
}

export const printRoutingService = new PrintRoutingService();

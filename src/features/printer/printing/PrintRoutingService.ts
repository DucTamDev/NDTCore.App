import type { PrintKind } from '../models/printer/PrintKind';
import type { Printer } from '../models/printer/Printer';
import { PrinterRepository } from '../storage/PrinterRepository';

interface PrintRoutingServiceDeps {
  getPrinters: typeof PrinterRepository.getPrinters;
}

/**
 * CHỈ biết "loại nội dung nào → máy in nào": mỗi `Printer` in đúng một `kind`.
 */
export const createPrintRoutingService = (deps: PrintRoutingServiceDeps) => {
  const resolveTargets = (kind: PrintKind): Printer[] =>
    deps.getPrinters().filter((printer) => printer.enabled && printer.kind === kind);

  return { resolveTargets };
};

export const PrintRoutingService = createPrintRoutingService({ getPrinters: PrinterRepository.getPrinters });

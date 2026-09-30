import type { PrintType } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';
import { PrinterRepository } from '../storage/PrinterRepository';

interface PrintRoutingServiceDeps {
  getPrinters: typeof PrinterRepository.getPrinters;
}

/**
 * CHỈ biết "content type nào → printer nào" (spec §4) — mỗi `Printer` giờ cố
 * định đúng 1 `type` nên không còn bước tìm driver bên trong nữa.
 */
export const createPrintRoutingService = (deps: PrintRoutingServiceDeps) => {
  const resolveTargets = (printType: PrintType): Printer[] =>
    deps.getPrinters().filter((printer) => printer.enabled && printer.type === printType);

  return { resolveTargets };
};

export const PrintRoutingService = createPrintRoutingService({ getPrinters: PrinterRepository.getPrinters });

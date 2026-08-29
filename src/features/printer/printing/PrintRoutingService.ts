import type { Printer, PrinterDriver } from '../types/printer.types';
import type { PrintType } from '../types/printConfiguration.types';
import { PrinterService } from './PrinterService';

export interface PrintTarget {
  printer: Printer;
  driver: PrinterDriver;
}

interface PrintRoutingServiceDeps {
  getPrinters: typeof PrinterService.getPrinters;
}

/**
 * CHỈ biết "content type nào → printer nào / driver nào" (spec §7.1) —
 * không biết cách driver mã hoá/gửi dữ liệu, không quyết định document
 * variant nào được dùng (đó là driver capability concern, xem
 * `drivers/tspl/TsplDriver.ts`).
 */
export const createPrintRoutingService = (deps: PrintRoutingServiceDeps) => {
  const resolveTargets = (printType: PrintType): PrintTarget[] => {
    const targets: PrintTarget[] = [];
    for (const printer of deps.getPrinters()) {
      if (!printer.enabled) continue;
      const driver = printer.drivers.find((d) => d.contentTypes.includes(printType));
      if (driver) targets.push({ printer, driver });
    }
    return targets;
  };

  return { resolveTargets };
};

export const PrintRoutingService = createPrintRoutingService({ getPrinters: PrinterService.getPrinters });

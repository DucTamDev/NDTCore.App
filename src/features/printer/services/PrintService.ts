import { PrintConfigurationService } from './PrintConfigurationService';
import { PrinterService } from './PrinterService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import type { PrintType } from '../types/printConfiguration.types';
import type { PrintDocument } from '../types/printDocument.types';
import type { PrintJob, PrintResult } from '../types/printJob.types';

interface PrintServiceDeps {
  getDefaultPrinterIdsForType: typeof PrintConfigurationService.getDefaultPrinterIdsForType;
  getPrinters: typeof PrinterService.getPrinters;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

const printTypeLabel = (printType: PrintType): string => (printType === 'Receipt' ? 'Hoá đơn' : 'Tem');

export const createPrintService = (deps: PrintServiceDeps) => {
  const effectivePrinterIds = (printType: PrintType): string[] => {
    const configuredIds = new Set(deps.getDefaultPrinterIdsForType(printType));
    return deps.getPrinters()
      .filter((p) => p.enabled && configuredIds.has(p.id))
      .map((p) => p.id);
  };

  const print = async (printType: PrintType, document: PrintDocument): Promise<PrintResult> => {
    const printerIds = effectivePrinterIds(printType);
    if (printerIds.length === 0) {
      return {
        status: 'no-available-printer',
        jobs: [],
        error: { code: 'NO_AVAILABLE_PRINTER', message: `Chưa thiết lập máy in cho ${printTypeLabel(printType)}` },
      };
    }

    const requestId = generateId();
    const jobs: PrintJob[] = await Promise.all(
      printerIds.map((printerId) =>
        deps.scheduler.enqueue({
          id: generateId(),
          requestId,
          printerId,
          document,
          status: 'pending',
          retryCount: 0,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    const successCount = jobs.filter((job) => job.status === 'success').length;
    const status = successCount === jobs.length ? 'success' : successCount === 0 ? 'failed' : 'partial-failure';
    return { status, jobs };
  };

  return { print };
};

export const PrintService = createPrintService({
  getDefaultPrinterIdsForType: PrintConfigurationService.getDefaultPrinterIdsForType,
  getPrinters: PrinterService.getPrinters,
  scheduler: PrintScheduler,
});

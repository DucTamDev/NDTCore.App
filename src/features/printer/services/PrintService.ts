import { DestinationService } from './DestinationService';
import { PrinterService } from './PrinterService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import type { PrintPlan, PrintJob, PrintResult } from '../types/printJob.types';

interface PrintServiceDeps {
  getDestinations: typeof DestinationService.getDestinations;
  getPrinters: typeof PrinterService.getPrinters;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

export const createPrintService = (deps: PrintServiceDeps) => {
  const effectivePrinterIds = (destinationId: string): string[] => {
    const destination = deps.getDestinations().find((d) => d.id === destinationId);
    if (!destination || !destination.enabled) return [];
    const enabledPrinterIds = new Set(deps.getPrinters().filter((p) => p.enabled).map((p) => p.id));
    return destination.printerIds.filter((id) => enabledPrinterIds.has(id));
  };

  const makeJob = (plan: PrintPlan, printerId: string): PrintJob => ({
    id: generateId(),
    planId: plan.id,
    printerId,
    document: plan.document,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  const print = async (plan: PrintPlan): Promise<PrintResult> => {
    const destination = deps.getDestinations().find((d) => d.id === plan.destinationId);
    const printerIds = effectivePrinterIds(plan.destinationId);
    if (printerIds.length === 0) {
      return {
        status: 'no-available-printer',
        jobs: [],
        error: { code: 'NO_AVAILABLE_PRINTER', message: `Không có máy in khả dụng cho điểm in ${plan.destinationId}` },
      };
    }

    if (destination?.fanoutMode === 'broadcast') {
      const jobs = await Promise.all(printerIds.map((printerId) => deps.scheduler.enqueue(makeJob(plan, printerId))));
      const successCount = jobs.filter((job) => job.status === 'success').length;
      const status = successCount === jobs.length ? 'success' : successCount === 0 ? 'failed' : 'partial-failure';
      return { status, jobs };
    }

    const jobs: PrintJob[] = [];
    for (const printerId of printerIds) {
      const job = await deps.scheduler.enqueue(makeJob(plan, printerId));
      jobs.push(job);
      if (job.status === 'success') return { status: 'success', jobs };
    }
    return { status: 'failed', jobs };
  };

  return { print };
};

export const PrintService = createPrintService({
  getDestinations: DestinationService.getDestinations,
  getPrinters: PrinterService.getPrinters,
  scheduler: PrintScheduler,
});

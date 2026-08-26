import { PrintRoutingService, type PrintTarget } from './PrintRoutingService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import { PRINT_TYPE_LABELS } from '../types/printConfiguration.types';
import type { PrintType } from '../types/printConfiguration.types';
import type { PaperSize } from '../types/printer.types';
import type { PrintDocumentVariants } from '../types/driver.types';
import type { PrintJob, PrintResult } from '../types/printJob.types';

export type { PrintDocumentVariants };

interface PrintServiceDeps {
  routing: Pick<typeof PrintRoutingService, 'resolveTargets'>;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

export const createPrintService = (deps: PrintServiceDeps) => {
  /**
   * `paperSize` cần để render ảnh cho `printType` này, hoặc `null` nếu không
   * có target nào dùng driver tspl — TSPL `renderMode` luôn `'bitmap'` nên
   * hễ có tspl target là cần ảnh, không còn toggle `tsplRenderAsImage` như
   * trước (spec §4.4). Nơi gọi (`OrderPrintTrigger`) chỉ nên tốn chi phí
   * capture khi có giá trị trả về.
   */
  const imageDocumentPaperSize = (printType: PrintType): PaperSize | null => {
    const target = deps.routing.resolveTargets(printType).find((t: PrintTarget) => t.driver.type === 'tspl');
    return target ? target.printer.paperSize : null;
  };

  const print = async (printType: PrintType, documentVariants: PrintDocumentVariants): Promise<PrintResult> => {
    const targets = deps.routing.resolveTargets(printType);
    if (targets.length === 0) {
      return {
        status: 'no-available-printer',
        jobs: [],
        error: { code: 'NO_AVAILABLE_PRINTER', message: `Chưa thiết lập máy in cho ${PRINT_TYPE_LABELS[printType]}` },
      };
    }
    const requestId = generateId();
    const jobs: PrintJob[] = await Promise.all(
      targets.map(({ printer }) =>
        deps.scheduler.enqueue({
          id: generateId(),
          requestId,
          printerId: printer.id,
          printType,
          documentVariants,
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

  return { print, imageDocumentPaperSize };
};

export const PrintService = createPrintService({ routing: PrintRoutingService, scheduler: PrintScheduler });

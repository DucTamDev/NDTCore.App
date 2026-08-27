import { PrintRoutingService, type PrintTarget } from './PrintRoutingService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import { PRINT_TYPE_LABELS } from '../types/printConfiguration.types';
import { AppErrorCode } from '../types/AppError';
import type { PrintType } from '../types/printConfiguration.types';
import { isTsplTrueTypeActive, PrinterDriverType } from '../types/printer.types';
import type { PaperSize } from '../types/printer.types';
import type { PrintDocumentVariants } from '../types/driver.types';
import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../types/printJob.types';

export type { PrintDocumentVariants };

interface PrintServiceDeps {
  routing: Pick<typeof PrintRoutingService, 'resolveTargets'>;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

export const createPrintService = (deps: PrintServiceDeps) => {
  /**
   * `paperSize` cần để render ảnh cho `printType` này, hoặc `null` nếu
   * không có target nào tspl thật sự cần ảnh. TSPL `renderMode` có thể là
   * `'bitmap'` (mặc định, cần ảnh) HOẶC `'truetype'` (thử nghiệm — khi đã
   * cài font thành công thì `TsplDriver.encode()` dùng thẳng `documents.text`,
   * bỏ qua `documents.image` hoàn toàn, xem spec 2026-08-27 §7) — nên chỉ
   * coi là "cần ảnh" nếu target CHƯA ở chế độ truetype đã cài font xong.
   * Nơi gọi (`OrderPrintTrigger`) chỉ nên tốn chi phí capture khi có giá
   * trị trả về.
   */
  const imageDocumentPaperSize = (printType: PrintType): PaperSize | null => {
    const target = deps.routing.resolveTargets(printType).find((t: PrintTarget) => t.driver.type === PrinterDriverType.tspl && !isTsplTrueTypeActive(t.driver));
    return target ? target.printer.paperSize : null;
  };

  const print = async (printType: PrintType, documentVariants: PrintDocumentVariants): Promise<PrintResult> => {
    const targets = deps.routing.resolveTargets(printType);
    if (targets.length === 0) {
      return {
        status: PrintResultStatus.noAvailablePrinter,
        jobs: [],
        error: { code: AppErrorCode.NO_AVAILABLE_PRINTER, message: `Chưa thiết lập máy in cho ${PRINT_TYPE_LABELS[printType]}` },
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
          status: PrintJobStatus.pending,
          retryCount: 0,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    const successCount = jobs.filter((job) => job.status === PrintJobStatus.success).length;
    const status = successCount === jobs.length ? PrintResultStatus.success : successCount === 0 ? PrintResultStatus.failed : PrintResultStatus.partialFailure;
    return { status, jobs };
  };

  return { print, imageDocumentPaperSize };
};

export const PrintService = createPrintService({ routing: PrintRoutingService, scheduler: PrintScheduler });

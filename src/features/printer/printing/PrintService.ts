import { PrintRoutingService, type PrintTarget } from './PrintRoutingService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import { PRINT_TYPE_LABELS } from '../types/printConfiguration.types';
import { AppErrorCode } from '../types/AppError';
import type { PrintType } from '../types/printConfiguration.types';
import { PrinterDriverType, tsplRenderModeOf, TsplRenderMode } from '../types/printer.types';
import type { PaperSize } from '../types/printer.types';
import type { PrintDocuments } from '../types/driver.types';
import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../types/printJob.types';

export type { PrintDocuments };

interface PrintServiceDeps {
  routing: Pick<typeof PrintRoutingService, 'resolveTargets'>;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

export const createPrintService = (deps: PrintServiceDeps) => {
  /**
   * `paperSize` cần để render ảnh cho `printType` này, hoặc `null` nếu
   * không có target nào tspl đang cấu hình `renderMode: 'bitmap'`. Target
   * cấu hình `'truetype'` không cần ảnh — `TsplTrueTypeStrategy` dùng thẳng
   * `documents.text`, bỏ qua `documents.image` hoàn toàn (nếu font chưa cài
   * xong thì strategy tự ném lỗi in, không phải việc tầng này né tránh).
   * Nơi gọi (`OrderPrintTrigger`) chỉ nên tốn chi phí capture khi có giá
   * trị trả về.
   */
  const imageDocumentPaperSize = (printType: PrintType): PaperSize | null => {
    const target = deps.routing.resolveTargets(printType).find((t: PrintTarget) => t.driver.type === PrinterDriverType.tspl && tsplRenderModeOf(t.driver) === TsplRenderMode.bitmap);
    return target ? target.printer.paperSize : null;
  };

  const print = async (printType: PrintType, documents: PrintDocuments): Promise<PrintResult> => {
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
          documents,
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

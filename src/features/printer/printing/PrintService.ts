import { PrintRoutingService } from './PrintRoutingService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import { PRINT_TYPE_LABELS } from '../models/printing/PrintType';
import { PrinterErrorCode } from '../errors/PrinterError';
import type { PrintType } from '../models/printing/PrintType';
import { usesBitmapRenderMode } from '../drivers/driverConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import type { PrintDocuments } from '../drivers/IPrinterDriver';
import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../models/printing/PrintJob';

export type { PrintDocuments };

interface PrintServiceDeps {
  routing: Pick<typeof PrintRoutingService, 'resolveTargets'>;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

/** `successCount`/`total` → kết quả tổng hợp: tất cả OK / tất cả fail / 1 phần fail. */
const resolveResultStatus = (successCount: number, total: number): PrintResultStatus => {
  if (successCount === total) {
    return PrintResultStatus.Success;
  }

  if (successCount === 0) {
    return PrintResultStatus.Failed;
  }

  return PrintResultStatus.PartialFailure;
};

export const createPrintService = (deps: PrintServiceDeps) => {
  /**
   * `PrintPaperConfig` cần để render ảnh cho `printType` này, hoặc `null` nếu
   * không có target nào (TSPL hoặc ESC/POS) đang cấu hình `renderMode:
   * 'Bitmap'`. Nơi gọi (`OrderPrintTrigger`) chỉ nên tốn chi phí capture khi
   * có giá trị trả về — capture theo `paper` để máy die-cut chụp đúng bề rộng
   * tem (`itemWidthMm`) thay vì bề rộng giấy đầy đủ.
   */
  const imageDocumentMedia = (printType: PrintType): PrintPaperConfig | null => {
    const target = deps.routing.resolveTargets(printType).find((printer) => usesBitmapRenderMode(printer.driver));
    return target ? target.paper : null;
  };

  const print = async (printType: PrintType, documents: PrintDocuments): Promise<PrintResult> => {
    const targets = deps.routing.resolveTargets(printType);

    if (targets.length === 0) {
      return {
        status: PrintResultStatus.NoAvailablePrinter,
        jobs: [],
        error: { code: PrinterErrorCode.NO_AVAILABLE_PRINTER, message: `Chưa thiết lập máy in cho ${PRINT_TYPE_LABELS[printType]}` },
      };
    }

    const requestId = generateId();
    const jobs: PrintJob[] = await Promise.all(
      targets.map((printer) =>
        deps.scheduler.enqueue({
          id: generateId(),
          requestId,
          printerId: printer.id,
          printType,
          documents,
          status: PrintJobStatus.Pending,
          retryCount: 0,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    const successCount = jobs.filter((job) => job.status === PrintJobStatus.Success).length;
    const status = resolveResultStatus(successCount, jobs.length);
    return { status, jobs };
  };

  return { print, imageDocumentMedia };
};

export const PrintService = createPrintService({ routing: PrintRoutingService, scheduler: PrintScheduler });

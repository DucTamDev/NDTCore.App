import { printRoutingService, type PrintRoutingService } from './PrintRoutingService';
import { printScheduler, type PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';
import { PrinterErrorCode } from '../errors/PrinterError';
import type { PrintKind } from '../models/printer/PrintKind';
import { RenderMode, type RasterSource } from '../models/printer/PrinterLanguage';
import type { PaperOptions } from '../models/paper/PaperOptions';
import type { PrintDocuments } from '../models/printing/PrintDocuments';
import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../models/printing/PrintJob';

export type { PrintDocuments };

/** Phụ thuộc của service, tách ra để test thay được. */
export interface PrintServiceDeps {
  routing: Pick<PrintRoutingService, 'resolveTargets'>;

  scheduler: Pick<PrintScheduler, 'enqueue'>;
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

/** Điểm vào công khai: in một loại nội dung ra mọi máy in đang nhận loại đó. */
export class PrintService {
  constructor(private readonly deps: PrintServiceDeps) {}

  /**
   * Target (paper + rasterSource) cần để render ảnh cho `kind` này, hoặc
   * `null` nếu không có target nào (TSPL hoặc ESC/POS) đang cấu hình
   * `renderMode: 'Raster'`. Nơi gọi (`OrderPrintTrigger`) chỉ nên tốn chi phí
   * capture khi có giá trị trả về — capture theo `paper` để máy die-cut chụp
   * đúng bề rộng tem (`itemWidthMm`) thay vì bề rộng giấy đầy đủ.
   */
  imageDocumentTarget(kind: PrintKind): { paper: PaperOptions; rasterSource: RasterSource } | null {
    const target = this.deps.routing
      .resolveTargets(kind)
      .find((printer) => printer.language.renderMode === RenderMode.Raster);
    return target ? { paper: target.paper, rasterSource: target.language.rasterSource } : null;
  }

  async print(kind: PrintKind, documents: PrintDocuments): Promise<PrintResult> {
    const targets = this.deps.routing.resolveTargets(kind);

    if (targets.length === 0) {
      return {
        status: PrintResultStatus.NoAvailablePrinter,
        jobs: [],
        error: { code: PrinterErrorCode.NO_AVAILABLE_PRINTER, message: `Chưa thiết lập máy in cho ${PRINT_KIND_LABELS[kind]}` },
      };
    }

    const requestId = generateId();
    const jobs: PrintJob[] = await Promise.all(
      targets.map((printer) =>
        this.deps.scheduler.enqueue({
          id: generateId(),
          requestId,
          printerId: printer.id,
          kind,
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
  }
}

export const printService = new PrintService({ routing: printRoutingService, scheduler: printScheduler });

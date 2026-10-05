import { printRoutingService, type PrintRoutingService } from './PrintRoutingService';
import { printScheduler, type PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';
import { PrintErrorCode } from '../errors/PrintErrorCode';
import { PrintErrorException } from '../exceptions';
import type { PrintKind } from '../models/printer/PrintKind';
import type { PaperOptions } from '../models/paper/PaperOptions';
import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../models/printing/PrintJob';

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
   * Giấy của máy in đầu tiên nhận `kind`, hoặc `null` nếu chưa có máy nào — nơi gọi chỉ chụp ảnh khi có giá trị, và
   * chụp theo giấy này để máy tem chụp đúng bề rộng tem thay vì cả cuộn.
   */
  paperFor(kind: PrintKind): PaperOptions | null {
    return this.deps.routing.resolveTargets(kind)[0]?.paper ?? null;
  }

  async print(kind: PrintKind, image: string): Promise<PrintResult> {
    const targets = this.deps.routing.resolveTargets(kind);

    if (targets.length === 0) {
      return {
        status: PrintResultStatus.NoAvailablePrinter,
        jobs: [],
        error: new PrintErrorException({
          code: PrintErrorCode.NO_AVAILABLE_PRINTER,
          message: `Chưa thiết lập máy in cho ${PRINT_KIND_LABELS[kind]}`,
        }),
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
          image,
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

import { printerService, type PrinterService } from './PrinterService';
import { printerConnectionLock, type ResourceLock } from '../connection/PrinterConnectionLock';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import { generateId } from '../../../utils/id';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';
import { PrintErrorCode } from '../errors';
import { PrintErrorException, toPrinterFeatureException } from '../exceptions';
import type { PrintKind } from '../models/printer/PrintKind';
import type { Printer } from '../models/printer/Printer';
import type { PaperOptions } from '../models/paper/PaperOptions';
import { PrintTaskStatus } from '../models/printing/PrintTaskStatus';
import { PrintStatus } from '../models/printing/PrintStatus';
import type { PrintTask } from '../models/printing/PrintTask';
import type { PrintResult } from '../models/printing/PrintResult';

/** `successCount`/`total` → kết quả tổng hợp: tất cả OK / tất cả fail / 1 phần fail. */
const resolvePrintStatus = (successCount: number, total: number): PrintStatus => {
  if (successCount === total) {
    return PrintStatus.Success;
  }

  if (successCount === 0) {
    return PrintStatus.Failed;
  }

  return PrintStatus.PartialFailure;
};

/** Điểm vào công khai: in một loại nội dung ra mọi máy in đang nhận loại đó. */
export class PrintService {
  constructor(
    /** Nguồn máy in đã lưu để chọn máy nhận lệnh. */
    private readonly repository: PrinterRepository = printerRepository,

    /** In một lệnh in trên máy của nó. */
    private readonly printing: PrinterService = printerService,

    /** Khoá theo máy vật lý, dùng chung với nút "In thử". */
    private readonly lock: ResourceLock = printerConnectionLock,
  ) {}

  /**
   * Giấy của máy in đầu tiên nhận `kind`, hoặc `null` nếu chưa có máy nào — nơi gọi chỉ chụp ảnh khi có giá trị, và
   * chụp theo giấy này để máy tem chụp đúng bề rộng tem thay vì cả cuộn.
   */
  paperFor(kind: PrintKind): PaperOptions | null {
    return this.targetsOf(kind)[0]?.paper ?? null;
  }

  /** Mỗi máy nhận một lệnh in; máy khác nhau in song song, cùng máy vật lý in lần lượt. Không throw. */
  async print(kind: PrintKind, image: string): Promise<PrintResult> {
    const targets = this.targetsOf(kind);

    if (targets.length === 0) {
      return {
        status: PrintStatus.NoAvailablePrinter,
        tasks: [],
        error: new PrintErrorException({
          code: PrintErrorCode.NO_AVAILABLE_PRINTER,
          message: `Chưa thiết lập máy in cho ${PRINT_KIND_LABELS[kind]}`,
        }),
      };
    }

    const tasks = await Promise.all(targets.map((printer) => this.run(this.createTask(printer, kind, image))));
    const successCount = tasks.filter((task) => task.status === PrintTaskStatus.Success).length;
    const status = resolvePrintStatus(successCount, tasks.length);
    return { status, tasks };
  }

  /** Máy in đang bật và nhận loại nội dung `kind`. */
  private targetsOf(kind: PrintKind): Printer[] {
    return this.repository.getPrinters().filter((printer) => printer.enabled && printer.kind === kind);
  }

  private createTask(printer: Printer, kind: PrintKind, data: string): PrintTask {
    return {
      id: generateId(),
      printerId: printer.id,
      printerName: printer.name,
      deviceId: printer.deviceId,
      connectionType: printer.connection.type,
      kind,
      data,
      status: PrintTaskStatus.Pending,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
  }

  /** Khoá theo `task.deviceId`, trùng `lockKeyOf` của máy in đã lưu nên cùng khoá với nút "In thử". */
  private run(task: PrintTask): Promise<PrintTask> {
    return this.lock.runExclusive(task.deviceId, async () => {
      task.status = PrintTaskStatus.Printing;
      task.startedAt = new Date().toISOString();

      try {
        await this.printing.print(task.printerId, task.data);
        task.status = PrintTaskStatus.Success;
      } catch (error) {
        task.status = PrintTaskStatus.Failed;
        task.error = toPrinterFeatureException(error);
      }

      task.completedAt = new Date().toISOString();
      return task;
    });
  }
}

export const printService = new PrintService();

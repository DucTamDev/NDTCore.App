import { printerService, type PrinterService } from './PrinterService';
import { printerConnectionLock, type PrinterConnectionLock } from '../connection/PrinterConnectionLock';
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
import type { PrintTaskResult } from '../models/printing/PrintTaskResult';
import type { PrintResult } from '../models/printing/PrintResult';

/** Chụp nội dung cần in theo một khổ giấy, ra ảnh PNG base64; `null` khi chụp không được. */
export type RenderPrintImage = (paper: PaperOptions) => Promise<string | null>;

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
    private readonly lock: PrinterConnectionLock = printerConnectionLock,
  ) {}

  /**
   * Mỗi máy nhận một lệnh in với ảnh chụp theo giấy của chính nó; máy khác nhau in song song, cùng máy vật lý in lần
   * lượt. Không có máy nào thì không chụp. Chụp hỏng thì cả yêu cầu thất bại, không gửi gì. Không throw.
   */
  async print(kind: PrintKind, render: RenderPrintImage): Promise<PrintResult> {
    const printers = this.findEnabledPrintersByKind(kind);

    if (printers.length === 0) {
      return {
        status: PrintStatus.NoAvailablePrinter,
        results: [],
        error: new PrintErrorException({
          code: PrintErrorCode.NO_AVAILABLE_PRINTER,
          message: `Chưa thiết lập máy in cho ${PRINT_KIND_LABELS[kind]}`,
        }),
      };
    }

    const tasks = await this.createTasks(printers, render, PRINT_KIND_LABELS[kind]).catch(() => null);

    if (!tasks) {
      return {
        status: PrintStatus.Failed,
        results: [],
        error: new PrintErrorException({
          code: PrintErrorCode.INVALID_IMAGE,
          message: `Không chụp được nội dung ${PRINT_KIND_LABELS[kind]} để in`,
        }),
      };
    }

    const results = await Promise.all(tasks.map((task) => this.run(task)));

    const successCount = results.filter((result) => result.status === PrintTaskStatus.Success).length;
    const status = resolvePrintStatus(successCount, results.length);
    return { status, results };
  }

  /** Máy in đang bật và nhận loại nội dung `kind`. */
  private findEnabledPrintersByKind(kind: PrintKind): Printer[] {
    return this.repository.getPrinters().filter((printer) => printer.enabled && printer.kind === kind);
  }

  /**
   * Máy cùng cấu hình giấy dùng chung một ảnh, khác giấy (58mm với 80mm, tem khác cỡ) chụp riêng. Chụp lần lượt vì chỉ
   * có một khung chụp. `null` khi một lần chụp hỏng.
   */
  private async createTasks(
    printers: Printer[],
    render: RenderPrintImage,
    title: string,
  ): Promise<PrintTask[] | null> {
    const imageByPaper = new Map<string, string>();
    const tasks: PrintTask[] = [];

    for (const printer of printers) {
      const paperKey = JSON.stringify(printer.paper);
      const image = imageByPaper.get(paperKey) ?? (await render(printer.paper));

      if (!image) {
        return null;
      }

      imageByPaper.set(paperKey, image);
      tasks.push(this.createTask(printer, image, title));
    }

    return tasks;
  }

  private createTask(printer: Printer, data: string, title: string): PrintTask {
    return {
      id: generateId(),
      printerId: printer.id,
      printerName: printer.name,
      deviceId: printer.deviceId,
      connectionType: printer.connection.type,
      kind: printer.kind,
      data,
      title,
      createdAt: new Date().toISOString(),
    };
  }

  /** Khoá theo `task.deviceId` (native trả), cùng khoá với nút "In thử" và lệnh ngắt trên máy đó. */
  private run(task: PrintTask): Promise<PrintTaskResult> {
    return this.lock.runExclusive(task.deviceId, async () => {
      const startedAt = new Date().toISOString();

      try {
        await this.printing.print(task.printerId, task.data);
        return { task, status: PrintTaskStatus.Success, startedAt, completedAt: new Date().toISOString() };
      } catch (error) {
        return {
          task,
          status: PrintTaskStatus.Failed,
          error: toPrinterFeatureException(error),
          startedAt,
          completedAt: new Date().toISOString(),
        };
      }
    });
  }
}

export const printService = new PrintService();

import { printQueue, type PrintQueue } from './PrintQueue';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import { generateId } from '../../../utils/id';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';
import { PrintErrorCode } from '../errors';
import { PrintErrorException } from '../exceptions';
import type { PrintKind } from '../models/printer/PrintKind';
import type { Printer } from '../models/printer/Printer';
import type { PaperOptions } from '../models/paper/PaperOptions';
import { PrintEnqueueStatus } from '../models/printing/PrintEnqueueStatus';
import type { PrintEnqueueResult } from '../models/printing/PrintEnqueueResult';
import type { PrintTask } from '../models/printing/PrintTask';

/** Chụp nội dung cần in theo một khổ giấy, ra ảnh PNG base64; `null` khi chụp không được. */
export type RenderPrintImage = (paper: PaperOptions) => Promise<string | null>;

/** Điểm vào công khai: đưa một loại nội dung vào hàng đợi in của mọi máy in đang nhận loại đó. */
export class PrintService {
  constructor(
    /** Nguồn máy in đã lưu để chọn máy nhận lệnh. */
    private readonly repository: PrinterRepository = printerRepository,

    /** Hàng đợi in theo máy vật lý. */
    private readonly queue: PrintQueue = printQueue,
  ) {}

  /**
   * Mỗi máy nhận một lệnh với ảnh chụp theo giấy của chính nó, rồi trả về ngay, không chờ in xong. Không có máy nào thì
   * không chụp; chụp hỏng thì không lệnh nào vào hàng đợi. Không throw. `title` mô tả nội dung để báo lỗi khi in.
   */
  async print(kind: PrintKind, render: RenderPrintImage, title: string): Promise<PrintEnqueueResult> {
    const printers = this.findEnabledPrintersByKind(kind);

    if (printers.length === 0) {
      return {
        status: PrintEnqueueStatus.NoAvailablePrinter,
        tasks: [],
        error: new PrintErrorException({
          code: PrintErrorCode.NO_AVAILABLE_PRINTER,
          message: `Chưa thiết lập máy in cho ${PRINT_KIND_LABELS[kind]}`,
        }),
      };
    }

    const tasks = await this.createTasks(printers, render, title).catch(() => null);

    if (!tasks) {
      return {
        status: PrintEnqueueStatus.CaptureFailed,
        tasks: [],
        error: new PrintErrorException({
          code: PrintErrorCode.INVALID_IMAGE,
          message: `Không chụp được nội dung ${PRINT_KIND_LABELS[kind]} để in`,
        }),
      };
    }

    tasks.forEach((task) => this.queue.enqueue(task));
    return { status: PrintEnqueueStatus.Queued, tasks };
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
}

export const printService = new PrintService();

import type { PaperOptions } from '../models/paper/PaperOptions';
import type { Printer } from '../models/printer/Printer';
import type { RenderMode } from '../models/printer/PrinterLanguage';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';

/**
 * Sửa cách render / giấy của một máy in ĐÃ LƯU. Bản nháp chưa lưu thì không làm gì — modal Thêm máy in
 * mang các giá trị này vào lúc Lưu.
 */
export class PrinterConfigService {
  constructor(
    private readonly repository: Pick<PrinterRepository, 'getPrinters' | 'savePrinters'> = printerRepository,
  ) {}

  setRenderMode(printerId: string, renderMode: RenderMode): void {
    this.update(printerId, (printer) => ({ ...printer, language: { ...printer.language, renderMode } }));
  }

  setPaper(printerId: string, paper: PaperOptions): void {
    this.update(printerId, (printer) => ({ ...printer, paper }));
  }

  private update(printerId: string, change: (printer: Printer) => Printer): void {
    const printers = this.repository.getPrinters();

    if (!printers.some((printer) => printer.id === printerId)) {
      return;
    }

    this.repository.savePrinters(printers.map((printer) => (printer.id === printerId ? change(printer) : printer)));
  }
}

export const printerConfigService = new PrinterConfigService();

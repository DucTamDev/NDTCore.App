import { PrinterService } from './PrinterService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import { PRINT_TYPE_LABELS } from '../types/printConfiguration.types';
import type { PrintType } from '../types/printConfiguration.types';
import type { PaperSize, PrinterConfig } from '../types/printer.types';
import type { PrintDocument } from '../types/printDocument.types';
import type { PrintJob, PrintResult } from '../types/printJob.types';

interface PrintServiceDeps {
  getPrinters: typeof PrinterService.getPrinters;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

/**
 * `text` là document dùng mặc định cho mọi protocol. `image` (tuỳ chọn) là
 * bản render sẵn thành ảnh — chỉ dùng cho máy in bật `tsplRenderAsImage`, xem
 * ghi chú ở `PrinterConfig.tsplRenderAsImage` (`printer.types.ts`). Nơi gọi
 * (component có React tree) tự capture trước khi gọi `print()`, vì bản thân
 * driver ở tầng service không có quyền render/chụp View.
 */
export interface PrintDocumentVariants {
  text: PrintDocument;
  image?: PrintDocument;
}

const printsForType = (printer: PrinterConfig, printType: PrintType): boolean =>
  printType === 'Receipt' ? Boolean(printer.printsReceipt) : Boolean(printer.printsLabel);

/** Chỉ máy TSPL bật `tsplRenderAsImage` mới ưu tiên dùng `documents.image` — xem `PrinterConfig.tsplRenderAsImage`. */
const prefersImage = (printer: PrinterConfig): boolean => printer.protocol === 'tspl' && Boolean(printer.tsplRenderAsImage);

const resolveDocumentForPrinter = (printer: PrinterConfig, documents: PrintDocumentVariants): PrintDocument =>
  documents.image && prefersImage(printer) ? documents.image : documents.text;

export const createPrintService = (deps: PrintServiceDeps) => {
  const effectivePrinters = (printType: PrintType): PrinterConfig[] =>
    deps.getPrinters().filter((p) => p.enabled && printsForType(p, printType));

  /**
   * `paperSize` cần dùng để render ảnh cho `printType` này, hoặc `null` nếu
   * không có máy in nào bật `tsplRenderAsImage` — nơi gọi (component) chỉ nên
   * tốn chi phí capture ảnh khi có giá trị trả về. Nếu nhiều máy TSPL được
   * gán cùng `printType` nhưng khác khổ giấy, chỉ khổ giấy của máy đầu tiên
   * được dùng — đơn giản hoá có chủ đích, chưa hỗ trợ render nhiều ảnh theo
   * từng khổ giấy khác nhau trong 1 lượt in.
   */
  const imageDocumentPaperSize = (printType: PrintType): PaperSize | null =>
    effectivePrinters(printType).find(prefersImage)?.paperSize ?? null;

  const print = async (printType: PrintType, documents: PrintDocumentVariants): Promise<PrintResult> => {
    const printers = effectivePrinters(printType);
    if (printers.length === 0) {
      return {
        status: 'no-available-printer',
        jobs: [],
        error: { code: 'NO_AVAILABLE_PRINTER', message: `Chưa thiết lập máy in cho ${PRINT_TYPE_LABELS[printType]}` },
      };
    }

    const requestId = generateId();
    const jobs: PrintJob[] = await Promise.all(
      printers.map((printer) =>
        deps.scheduler.enqueue({
          id: generateId(),
          requestId,
          printerId: printer.id,
          printType,
          document: resolveDocumentForPrinter(printer, documents),
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

export const PrintService = createPrintService({
  getPrinters: PrinterService.getPrinters,
  scheduler: PrintScheduler,
});

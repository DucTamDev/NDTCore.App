import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { RenderMode, BitmapSource } from '../models/printer/PrinterDriver';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Cấu hình render mode / giấy cho 1 printer ĐÃ LƯU. Printer draft chưa lưu →
 * no-op ở cả 2 setter — modal Thêm máy in mang state vào lúc Save (xem
 * `useAddPrinterFlow.ts`).
 */
export const createPrinterConfigService = (repository: PrinterRepositoryLike = PrinterRepository) => {
  const setRenderMode = (printerId: string, renderMode: RenderMode): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, driver: { ...p.driver, config: { ...p.driver.config, renderMode } } })),
    );
  };

  const setBitmapSource = (printerId: string, bitmapSource: BitmapSource): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, driver: { ...p.driver, config: { ...p.driver.config, bitmapSource } } })),
    );
  };

  const setPaper = (printerId: string, patch: Partial<PrintPaperConfig>): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, paper: { ...p.paper, ...patch } })));
  };

  return { setRenderMode, setBitmapSource, setPaper };
};

export const PrinterConfigService = createPrinterConfigService(PrinterRepository);

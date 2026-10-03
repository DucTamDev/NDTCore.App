import type { PaperOptions } from '../models/paper/PaperOptions';
import { RenderMode, RasterSource } from '../models/printer/PrinterLanguage';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Cấu hình render mode / bitmap source / giấy cho 1 printer ĐÃ LƯU. Printer
 * draft chưa lưu → no-op ở cả 3 setter — modal Thêm máy in mang state vào lúc
 * Save (xem `useAddPrinterFlow.ts`).
 */
export const createPrinterConfigService = (repository: PrinterRepositoryLike = PrinterRepository) => {
  const setRenderMode = (printerId: string, renderMode: RenderMode): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, language: { ...p.language, renderMode } })),
    );
  };

  const setRasterSource = (printerId: string, rasterSource: RasterSource): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, language: { ...p.language, rasterSource } })),
    );
  };

  const setPaper = (printerId: string, patch: Partial<PaperOptions>): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, paper: { ...p.paper, ...patch } })));
  };

  return { setRenderMode, setRasterSource, setPaper };
};

export const PrinterConfigService = createPrinterConfigService(PrinterRepository);

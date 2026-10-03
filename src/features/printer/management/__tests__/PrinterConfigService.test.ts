import { createPrinterConfigService } from '../PrinterConfigService';
import { createPrinterRepository } from '../../storage/PrinterRepository';
import { PrinterStorage } from '../../storage/PrinterStorage';
import { RenderMode } from '../../models/printer/PrinterLanguage';
import { CutterMode, PaperSize, PaperType } from '../../models/paper/PaperOptions';
import { type Printer } from '../../models/printer/Printer';
import { basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterConfigService', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it('setRenderMode() persists renderMode vào printer.language cho printer đã lưu', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService(repository);
    repository.addPrinter(basePrinter);

    service.setRenderMode(basePrinter.id, RenderMode.Raster);

    const saved = repository.getPrinters().find((p) => p.id === basePrinter.id)!;
    expect(saved.language).toMatchObject({ renderMode: RenderMode.Raster });
  });

  it('setRenderMode() là no-op cho printer chưa lưu', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService(repository);

    expect(() => service.setRenderMode('draft-not-saved', RenderMode.Raster)).not.toThrow();
    expect(repository.getPrinters()).toEqual([]);
  });

  it('setPaper() ghi đè printer.paper cho printer đã lưu', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService(repository);
    const printer: Printer = { ...basePrinter, paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob } };
    repository.addPrinter(printer);

    service.setPaper(printer.id, { type: PaperType.Continuous, paperSize: PaperSize.Mm100, cutterMode: CutterMode.PerJob });

    const saved = repository.getPrinters().find((p) => p.id === printer.id)!;
    expect(saved.paper).toMatchObject({ type: PaperType.Continuous, paperSize: PaperSize.Mm100, cutterMode: CutterMode.PerJob });
  });

  it('setPaper() là no-op cho printer chưa lưu', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService(repository);

    const paper = { type: PaperType.Continuous, paperSize: PaperSize.Mm100, cutterMode: CutterMode.PerJob } as const;

    expect(() => service.setPaper('not-saved', paper)).not.toThrow();
    expect(repository.getPrinters()).toEqual([]);
  });
});

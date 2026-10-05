import { PrinterConfigService } from '../PrinterConfigService';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { printerStorage } from '../../storage/PrinterStorage';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperSize } from '../../models/paper/PaperSize';
import { PaperType } from '../../models/paper/PaperType';
import { type Printer } from '../../models/printer/Printer';
import { basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterConfigService', () => {
  beforeEach(() => {
    printerStorage.savePrinters([]);
  });

  it('setPaper() ghi đè printer.paper cho printer đã lưu', () => {
    const repository = new PrinterRepository();
    const service = new PrinterConfigService(repository);
    const printer: Printer = { ...basePrinter, paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob } };
    repository.addPrinter(printer);

    service.setPaper(printer.id, { type: PaperType.Continuous, paperSize: PaperSize.Mm100, cutterMode: CutterMode.PerJob });

    const saved = repository.getPrinters().find((p) => p.id === printer.id)!;
    expect(saved.paper).toMatchObject({ type: PaperType.Continuous, paperSize: PaperSize.Mm100, cutterMode: CutterMode.PerJob });
  });

  it('setPaper() là no-op cho printer chưa lưu', () => {
    const repository = new PrinterRepository();
    const service = new PrinterConfigService(repository);

    const paper = { type: PaperType.Continuous, paperSize: PaperSize.Mm100, cutterMode: CutterMode.PerJob } as const;

    expect(() => service.setPaper('not-saved', paper)).not.toThrow();
    expect(repository.getPrinters()).toEqual([]);
  });
});

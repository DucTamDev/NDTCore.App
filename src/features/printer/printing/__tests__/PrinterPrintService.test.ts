import { createPrinterPrintService } from '../PrinterPrintService';
import { createPrinterRepository } from '../../storage/PrinterRepository';
import { createResourceLock } from '../../connection/PrinterConnectionLock';
import { PrinterStorage } from '../../storage/PrinterStorage';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { type Printer } from '../../models/printer/Printer';
import { PrintType } from '../../models/printing/PrintType';
import { makeMockDriver, escposDriverEntry, tsplDriverEntry, basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterPrintService', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it('print() forwards to the driver whose contentTypes includes the printType', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: escposDriver, tspl: tsplDriver }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
    const documents = { text: { elements: [] } };
    await service.print(twoDriverPrinter.id, documents, PrintType.Label);
    expect(tsplDriver.print).toHaveBeenCalledWith(twoDriverPrinter.id, documents, PrintType.Label);
    expect(escposDriver.print).not.toHaveBeenCalled();
  });

  it('print() forwards to the printer default driver, passing the printType through', async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents, PrintType.Receipt);
    expect(escposDriver.print).toHaveBeenCalledWith(basePrinter.id, documents, PrintType.Receipt);
  });

  it('print() connects first when the driver reports the printer is not connected', async () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.Idle) });
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents, PrintType.Receipt);
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter, escposDriverEntry);
    expect(escposDriver.print).toHaveBeenCalledWith(basePrinter.id, documents, PrintType.Receipt);
  });

  it('print() does not reconnect when the driver reports the printer is already connected', async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents, PrintType.Receipt);
    expect(escposDriver.connect).not.toHaveBeenCalled();
  });

  /**
   * Bất biến bắt buộc (spec 2026-09-09 §4.3) — `print()` luôn được
   * `PrintScheduler.enqueue()` gọi từ BÊN TRONG 1 `lock.runExclusive` đã
   * acquire sẵn. `PrinterConnectionLock` không reentrant nên nếu `print()` tự
   * lock lần nữa cùng key sẽ deadlock. Test này giữ nguyên bất biến đó khi ai
   * đó "sửa cho nhất quán với testPrint()".
   */
  it('print() does NOT acquire the connection lock itself — the caller (PrintScheduler) already holds it', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, lock);
    repository.addPrinter(basePrinter);
    await service.print(basePrinter.id, { text: { elements: [] } }, PrintType.Receipt);
    expect(runExclusiveSpy).not.toHaveBeenCalled();
  });

  it('testPrint() forwards printer+driver+documents straight to the matching driver, without persisting it', async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, createResourceLock());
    const documents = { text: { elements: [] } };
    await service.testPrint(basePrinter, escposDriverEntry, documents, PrintType.Receipt);
    expect(escposDriver.testPrint).toHaveBeenCalledWith(basePrinter, escposDriverEntry, documents, PrintType.Receipt, undefined);
    expect(repository.getPrinters()).toEqual([]);
  });

  it('testPrint() runs through the connection lock keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, lock);
    await service.testPrint(basePrinter, escposDriverEntry, { text: { elements: [] } }, PrintType.Receipt);
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
  });

  it('testPrint() forward options xuống driver.testPrint', async () => {
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: makeMockDriver(), tspl: tsplDriver }, repository, createResourceLock());
    const p = { ...basePrinter, drivers: [tsplDriverEntry] };
    await service.testPrint(p, tsplDriverEntry, { text: { elements: [] } }, PrintType.Label, { rows: 3 });
    expect(tsplDriver.testPrint).toHaveBeenCalledWith(p, tsplDriverEntry, expect.anything(), PrintType.Label, { rows: 3 });
  });

  it('print() / testPrint() never invoke the tspl driver installTsplFont (RULE 15-17)', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
    const documents = { text: { elements: [] } };

    await service.print(twoDriverPrinter.id, documents, PrintType.Label);
    await service.testPrint(twoDriverPrinter, tsplDriverEntry, documents, PrintType.Label);

    expect(tsplDriver.installTsplFont).not.toHaveBeenCalled();
  });
});

import { createPrinterPrintService } from '../PrinterPrintService';
import { createPrinterRepository } from '../../storage/PrinterRepository';
import { createResourceLock } from '../../connection/PrinterConnectionLock';
import { PrinterStorage } from '../../storage/PrinterStorage';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { PrinterDriverType } from '../../models/printer/PrinterDriver';
import { type Printer } from '../../models/printer/Printer';
import { PrintType } from '../../models/printing/PrintType';
import { makeMockDriver, tsplDriverEntry, basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterPrintService', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it("print() forwards to the printer's driver", async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: tsplDriver }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents);
    expect(escposDriver.print).toHaveBeenCalledWith(basePrinter.id, documents, undefined);
    expect(tsplDriver.print).not.toHaveBeenCalled();
  });

  it('print() connects first when the driver reports the printer is not connected', async () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.Idle) });
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents);
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter);
    expect(escposDriver.print).toHaveBeenCalledWith(basePrinter.id, documents, undefined);
  });

  it('print() does not reconnect when the driver reports the printer is already connected', async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents);
    expect(escposDriver.connect).not.toHaveBeenCalled();
  });

  it('print() forwards options through to driver.print', async () => {
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const tsplPrinter: Printer = { ...basePrinter, id: 'p2', identityKey: 'lan:192.168.1.11:9100', type: PrintType.Label, driver: tsplDriverEntry };
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: makeMockDriver(), [PrinterDriverType.Tspl]: tsplDriver }, repository, createResourceLock());
    repository.addPrinter(tsplPrinter);
    const documents = { text: { elements: [] } };
    await service.print(tsplPrinter.id, documents, { rows: 3 });
    expect(tsplDriver.print).toHaveBeenCalledWith(tsplPrinter.id, documents, { rows: 3 });
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
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, lock);
    repository.addPrinter(basePrinter);
    await service.print(basePrinter.id, { text: { elements: [] } });
    expect(runExclusiveSpy).not.toHaveBeenCalled();
  });

  it('testPrint() forwards printer+documents straight to the matching driver, without persisting it', async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    const documents = { text: { elements: [] } };
    await service.testPrint(basePrinter, documents);
    expect(escposDriver.testPrint).toHaveBeenCalledWith(basePrinter, documents, undefined);
    expect(repository.getPrinters()).toEqual([]);
  });

  it("testPrint() runs through the connection lock keyed by resourceKeyFor(printer)", async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, lock);
    await service.testPrint(basePrinter, { text: { elements: [] } });
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
  });

  it('testPrint() forwards options down to driver.testPrint', async () => {
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const p: Printer = { ...basePrinter, driver: tsplDriverEntry };
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: makeMockDriver(), [PrinterDriverType.Tspl]: tsplDriver }, repository, createResourceLock());
    const documents = { text: { elements: [] } };
    await service.testPrint(p, documents, { rows: 3 });
    expect(tsplDriver.testPrint).toHaveBeenCalledWith(p, documents, { rows: 3 });
  });

  it('print() / testPrint() never invoke the tspl driver installTsplFont (RULE 15-17)', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterPrintService({ [PrinterDriverType.EscPos]: makeMockDriver(), [PrinterDriverType.Tspl]: tsplDriver as never }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };

    await service.print(basePrinter.id, documents);
    await service.testPrint(basePrinter, documents);

    expect(tsplDriver.installTsplFont).not.toHaveBeenCalled();
  });
});

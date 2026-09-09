import { createPrinterConnectionService } from '../PrinterConnectionService';
import { createPrinterRepository } from '../../storage/PrinterRepository';
import { createResourceLock } from '../PrinterConnectionLock';
import { PrinterStorage } from '../../storage/PrinterStorage';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { type Printer } from '../../models/printer/Printer';
import { makeMockDriver, escposDriverEntry, tsplDriverEntry, basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterConnectionService', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it('connect() connects every driver of the printer', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: tsplDriver }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
    await service.connect(twoDriverPrinter.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(twoDriverPrinter, escposDriverEntry);
    expect(tsplDriver.connect).toHaveBeenCalledWith(twoDriverPrinter, tsplDriverEntry);
  });

  it('connect() does not let one driver failing block the other', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('offline')) });
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: tsplDriver }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
    await service.connect(twoDriverPrinter.id);
    expect(tsplDriver.connect).toHaveBeenCalled();
  });

  it('disconnect() disconnects every driver of the printer', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: tsplDriver }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
    await service.disconnect(twoDriverPrinter.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(twoDriverPrinter.id);
    expect(tsplDriver.disconnect).toHaveBeenCalledWith(twoDriverPrinter.id);
  });

  it('disconnect() does not let one driver failing block the other', async () => {
    const escposDriver = makeMockDriver({ disconnect: jest.fn().mockRejectedValue(new Error('offline')) });
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: tsplDriver }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
    await service.disconnect(twoDriverPrinter.id);
    expect(tsplDriver.disconnect).toHaveBeenCalled();
  });

  it('getStatus() returns connected when at least one driver of the printer is connected', () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.idle) });
    const tsplDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.connected) });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: tsplDriver }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
    expect(service.getStatus(twoDriverPrinter.id)).toBe(PrinterStatus.connected);
  });

  it('getStatus() falls back to the first driver status when none are connected', () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.error) });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.error);
  });

  it('onStatusChange() aggregates across drivers and unsubscribes every driver', () => {
    let tsplCallback: ((status: PrinterStatus) => void) | undefined;
    const escposUnsubscribe = jest.fn();
    const tsplUnsubscribe = jest.fn();
    const escposDriver = makeMockDriver({
      getStatus: jest.fn().mockReturnValue(PrinterStatus.idle),
      onStatusChange: jest.fn().mockReturnValue(escposUnsubscribe),
    });
    const tsplDriver = makeMockDriver({
      getStatus: jest.fn().mockReturnValue(PrinterStatus.idle),
      onStatusChange: jest.fn().mockImplementation((_printerId: string, cb: (status: PrinterStatus) => void) => {
        tsplCallback = cb;
        return tsplUnsubscribe;
      }),
    });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: tsplDriver }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);

    const callback = jest.fn();
    const unsubscribe = service.onStatusChange(twoDriverPrinter.id, callback);

    tsplDriver.getStatus.mockReturnValue(PrinterStatus.connected);
    tsplCallback?.(PrinterStatus.connected);
    expect(callback).toHaveBeenCalledWith(PrinterStatus.connected);

    unsubscribe();
    expect(escposUnsubscribe).toHaveBeenCalled();
    expect(tsplUnsubscribe).toHaveBeenCalled();
  });

  it('reconnect() disconnects then connects', async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    await service.reconnect(basePrinter.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(basePrinter.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter, escposDriverEntry);
  });

  it('reconnectAutoPrinters() connects only enabled printers with autoReconnect on', () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: tsplDriver }, repository, createResourceLock());
    const auto: Printer = { ...basePrinter, id: 'p-auto', autoReconnect: true, enabled: true, identityKey: 'lan:1.1.1.1:9100', connection: { type: 'lan', host: '1.1.1.1', port: 9100 } };
    const manual: Printer = { ...basePrinter, id: 'p-manual', autoReconnect: false, enabled: true, identityKey: 'lan:1.1.1.2:9100', connection: { type: 'lan', host: '1.1.1.2', port: 9100 } };
    repository.addPrinter(auto);
    repository.addPrinter(manual);
    service.reconnectAutoPrinters();
    expect(escposDriver.connect).toHaveBeenCalledTimes(1);
    expect(escposDriver.connect).toHaveBeenCalledWith(auto, escposDriverEntry);
  });

  it('reconnectAutoPrinters() swallows a connect failure for one printer without throwing', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('offline')) });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter({ ...basePrinter, autoReconnect: true, enabled: true });

    expect(() => service.reconnectAutoPrinters()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('connectDraft() connects via the driver matching the given driver type without touching storage', async () => {
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: makeMockDriver(), tspl: tsplDriver }, repository, createResourceLock());
    const draftPrinter: Printer = { ...basePrinter, id: 'draft-1', drivers: [tsplDriverEntry] };
    await service.connectDraft(draftPrinter, tsplDriverEntry);
    expect(tsplDriver.connect).toHaveBeenCalledWith(draftPrinter, tsplDriverEntry);
    expect(repository.getPrinters()).toEqual([]);
  });

  it('connect() runs the driver call through the connection lock, keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, lock);
    repository.addPrinter(basePrinter);
    await service.connect(basePrinter.id);
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter, escposDriverEntry);
  });

  it('disconnect() runs the driver call through the connection lock, keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, lock);
    repository.addPrinter(basePrinter);
    await service.disconnect(basePrinter.id);
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
    expect(escposDriver.disconnect).toHaveBeenCalledWith(basePrinter.id);
  });

  it('two printers sharing the same resourceKey never connect concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const escposDriver = makeMockDriver({
      connect: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
    });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: escposDriver, tspl: makeMockDriver() }, repository, createResourceLock());
    const second: Printer = { ...basePrinter, id: 'p2', identityKey: 'lan:1.1.1.2:9100', connection: { type: 'lan', host: '1.1.1.2', port: 9100 } };
    repository.addPrinter(basePrinter);
    repository.addPrinter(second);
    await Promise.all([service.connect(basePrinter.id), service.connect(second.id)]);
    expect(maxInFlight).toBe(1);
  });

  it('reconnect() never invokes the tspl driver installTsplFont (RULE 15-17)', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);

    await service.reconnect(twoDriverPrinter.id);

    expect(tsplDriver.installTsplFont).not.toHaveBeenCalled();
  });
});

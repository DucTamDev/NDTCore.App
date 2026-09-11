import { createPrinterConnectionService } from '../PrinterConnectionService';
import { createPrinterRepository } from '../../storage/PrinterRepository';
import { createResourceLock } from '../PrinterConnectionLock';
import { PrinterStorage } from '../../storage/PrinterStorage';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { PrinterDriverType } from '../../models/printer/PrinterDriver';
import { type Printer } from '../../models/printer/Printer';
import { makeMockDriver, escposDriverEntry, tsplDriverEntry, basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterConnectionService', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it("connect() connects via the printer's driver", async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    await service.connect(basePrinter.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter);
  });

  it("disconnect() disconnects via the printer's driver", async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    await service.disconnect(basePrinter.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(basePrinter.id);
  });

  it("getStatus() returns the status from the printer's driver", () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.Connected) });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Connected);
  });

  it("onStatusChange() subscribes to the printer's driver and unsubscribes on cleanup", () => {
    const unsubscribe = jest.fn();
    const escposDriver = makeMockDriver({ onStatusChange: jest.fn().mockReturnValue(unsubscribe) });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);

    const callback = jest.fn();
    const result = service.onStatusChange(basePrinter.id, callback);
    expect(escposDriver.onStatusChange).toHaveBeenCalledWith(basePrinter.id, callback);

    result();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('reconnect() disconnects then connects', async () => {
    const escposDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    await service.reconnect(basePrinter.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(basePrinter.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter);
  });

  it('reconnectAutoPrinters() connects only enabled printers with autoReconnect on', () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: tsplDriver }, repository, createResourceLock());
    const auto: Printer = { ...basePrinter, id: 'p-auto', autoReconnect: true, enabled: true, identityKey: 'lan:1.1.1.1:9100', connection: { type: 'Lan', host: '1.1.1.1', port: 9100 } };
    const manual: Printer = { ...basePrinter, id: 'p-manual', autoReconnect: false, enabled: true, identityKey: 'lan:1.1.1.2:9100', connection: { type: 'Lan', host: '1.1.1.2', port: 9100 } };
    repository.addPrinter(auto);
    repository.addPrinter(manual);
    service.reconnectAutoPrinters();
    expect(escposDriver.connect).toHaveBeenCalledTimes(1);
    expect(escposDriver.connect).toHaveBeenCalledWith(auto);
  });

  it('reconnectAutoPrinters() swallows a connect failure for one printer without throwing', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('offline')) });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter({ ...basePrinter, autoReconnect: true, enabled: true });

    expect(() => service.reconnectAutoPrinters()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('connectDraft() connects via the driver already attached to the draft printer, without touching storage', async () => {
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: makeMockDriver(), [PrinterDriverType.Tspl]: tsplDriver }, repository, createResourceLock());
    const draftPrinter: Printer = { ...basePrinter, id: 'draft-1', driver: tsplDriverEntry };
    await service.connectDraft(draftPrinter);
    expect(tsplDriver.connect).toHaveBeenCalledWith(draftPrinter);
    expect(repository.getPrinters()).toEqual([]);
  });

  it('disconnectForDriver() disconnects via the driver looked up by type, bypassing the repository', async () => {
    const tsplDriver = makeMockDriver();
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: makeMockDriver(), [PrinterDriverType.Tspl]: tsplDriver }, repository, createResourceLock());

    await service.disconnectForDriver(PrinterDriverType.Tspl, 'draft-1');

    expect(tsplDriver.disconnect).toHaveBeenCalledWith('draft-1');
    expect(repository.getPrinters()).toEqual([]);
  });

  it('getStatusForDriver() reads status from the driver looked up by type, bypassing the repository', () => {
    const tsplDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.Connected) });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: makeMockDriver(), [PrinterDriverType.Tspl]: tsplDriver }, repository, createResourceLock());

    expect(service.getStatusForDriver(PrinterDriverType.Tspl, 'draft-1')).toBe(PrinterStatus.Connected);
    expect(tsplDriver.getStatus).toHaveBeenCalledWith('draft-1');
  });

  it('onStatusChangeForDriver() subscribes to the driver looked up by type, bypassing the repository', () => {
    const unsubscribe = jest.fn();
    const tsplDriver = makeMockDriver({ onStatusChange: jest.fn().mockReturnValue(unsubscribe) });
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: makeMockDriver(), [PrinterDriverType.Tspl]: tsplDriver }, repository, createResourceLock());

    const callback = jest.fn();
    const result = service.onStatusChangeForDriver(PrinterDriverType.Tspl, 'draft-1', callback);
    expect(tsplDriver.onStatusChange).toHaveBeenCalledWith('draft-1', callback);

    result();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('connect() runs the driver call through the connection lock, keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, lock);
    repository.addPrinter(basePrinter);
    await service.connect(basePrinter.id);
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter);
  });

  it('disconnect() runs the driver call through the connection lock, keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, lock);
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
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: escposDriver, [PrinterDriverType.Tspl]: makeMockDriver() }, repository, createResourceLock());
    const second: Printer = { ...basePrinter, id: 'p2', identityKey: 'lan:1.1.1.2:9100', connection: { type: 'Lan', host: '1.1.1.2', port: 9100 } };
    repository.addPrinter(basePrinter);
    repository.addPrinter(second);
    await Promise.all([service.connect(basePrinter.id), service.connect(second.id)]);
    expect(maxInFlight).toBe(1);
  });

  it('reconnect() never invokes the tspl driver installTsplFont (RULE 15-17)', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConnectionService({ [PrinterDriverType.EscPos]: makeMockDriver(), [PrinterDriverType.Tspl]: tsplDriver as never }, repository, createResourceLock());
    repository.addPrinter({ ...basePrinter, driver: escposDriverEntry });

    await service.reconnect(basePrinter.id);

    expect(tsplDriver.installTsplFont).not.toHaveBeenCalled();
  });
});

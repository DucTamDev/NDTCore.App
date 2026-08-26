// src/features/printer/printing/__tests__/PrinterService.test.ts
import { createPrinterService } from '../PrinterService';
import { createResourceLock } from '../PrinterConnectionLock';
import { PrinterStorage } from '../../storage/PrinterStorage';
import type { IPrinterDriver } from '../../types/driver.types';
import type { Printer, PrinterDriver } from '../../types/printer.types';

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  encode: jest.fn().mockReturnValue(new Uint8Array()),
  ...overrides,
});

const escposDriverEntry: PrinterDriver = { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } };
const tsplDriverEntry: PrinterDriver = { type: 'tspl', source: 'auto', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } };

const basePrinter: Printer = {
  id: 'p1',
  name: 'Máy in hóa đơn quầy 1',
  drivers: [escposDriverEntry],
  connectionType: 'lan',
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PrinterService', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it('addPrinter() persists and getPrinters() returns it back', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    expect(service.getPrinters()).toEqual([basePrinter]);
  });

  it('addPrinter() throws when identityKey collides with a different existing printer', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const duplicate: Printer = { ...basePrinter, id: 'p2', name: 'Máy in khác' };
    expect(() => service.addPrinter(duplicate)).toThrow();
    expect(service.getPrinters()).toHaveLength(1);
  });

  it('updatePrinter() does not throw against its own identityKey', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const updated: Printer = { ...basePrinter, name: 'Tên mới' };
    expect(() => service.updatePrinter(updated)).not.toThrow();
    expect(service.getPrinters()[0].name).toBe('Tên mới');
  });

  it('removePrinter() removes it from the list', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    service.removePrinter(basePrinter.id);
    expect(service.getPrinters()).toEqual([]);
  });

  it('connect() connects every driver of the printer', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    await service.connect(twoDriverPrinter.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(twoDriverPrinter, escposDriverEntry);
    expect(tsplDriver.connect).toHaveBeenCalledWith(twoDriverPrinter, tsplDriverEntry);
  });

  it('connect() does not let one driver failing block the other', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('offline')) });
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    await service.connect(twoDriverPrinter.id);
    expect(tsplDriver.connect).toHaveBeenCalled();
  });

  it('getStatus() returns connected when at least one driver of the printer is connected', () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue('idle') });
    const tsplDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue('connected') });
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    expect(service.getStatus(twoDriverPrinter.id)).toBe('connected');
  });

  it('getStatus() falls back to the first driver status when none are connected', () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue('error') });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    expect(service.getStatus(basePrinter.id)).toBe('error');
  });

  it('print() forwards to the driver whose contentTypes includes the printType', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    const documents = { text: { elements: [] } };
    await service.print(twoDriverPrinter.id, documents, 'Label');
    expect(tsplDriver.print).toHaveBeenCalledWith(twoDriverPrinter.id, documents, 'Label');
    expect(escposDriver.print).not.toHaveBeenCalled();
  });

  it('print() forwards to the printer default driver when printType is omitted', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents);
    expect(escposDriver.print).toHaveBeenCalledWith(basePrinter.id, documents, undefined);
  });

  it('print() connects first when the driver reports the printer is not connected', async () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue('idle') });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents);
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter, escposDriverEntry);
    expect(escposDriver.print).toHaveBeenCalledWith(basePrinter.id, documents, undefined);
  });

  it('print() does not reconnect when the driver reports the printer is already connected', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents);
    expect(escposDriver.connect).not.toHaveBeenCalled();
  });

  it('testPrint() forwards printer+driver+documents straight to the matching driver, without persisting it', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    const documents = { text: { elements: [] } };
    await service.testPrint(basePrinter, escposDriverEntry, documents);
    expect(escposDriver.testPrint).toHaveBeenCalledWith(basePrinter, escposDriverEntry, documents, undefined);
    expect(service.getPrinters()).toEqual([]);
  });

  it('testPrint() runs through the connection lock keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, lock);
    await service.testPrint(basePrinter, escposDriverEntry, { text: { elements: [] } });
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
  });

  it('reconnect() disconnects then connects', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    await service.reconnect(basePrinter.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(basePrinter.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter, escposDriverEntry);
  });

  it('reconnectAutoPrinters() connects only enabled printers with autoReconnect on', () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const auto: Printer = { ...basePrinter, id: 'p-auto', autoReconnect: true, enabled: true, identityKey: 'lan:1.1.1.1:9100', lan: { ip: '1.1.1.1', port: 9100 } };
    const manual: Printer = { ...basePrinter, id: 'p-manual', autoReconnect: false, enabled: true, identityKey: 'lan:1.1.1.2:9100', lan: { ip: '1.1.1.2', port: 9100 } };
    service.addPrinter(auto);
    service.addPrinter(manual);
    service.reconnectAutoPrinters();
    expect(escposDriver.connect).toHaveBeenCalledTimes(1);
    expect(escposDriver.connect).toHaveBeenCalledWith(auto, escposDriverEntry);
  });

  it('reconnectAutoPrinters() swallows a connect failure for one printer without throwing', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('offline')) });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter({ ...basePrinter, autoReconnect: true, enabled: true });

    expect(() => service.reconnectAutoPrinters()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('setEnabled() updates enabled for that printer only', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    const second: Printer = { ...basePrinter, id: 'p2', identityKey: 'lan:1.1.1.2:9100', lan: { ip: '1.1.1.2', port: 9100 } };
    service.addPrinter(basePrinter);
    service.addPrinter(second);
    service.setEnabled('p1', false);
    expect(service.getPrinters().find((p) => p.id === 'p1')?.enabled).toBe(false);
    expect(service.getPrinters().find((p) => p.id === 'p2')?.enabled).toBe(true);
  });

  it('scanForConnectionType(usb) forwards to the escpos driver scan', () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    const onEvent = jest.fn();
    service.scanForConnectionType('usb', onEvent);
    expect(escposDriver.scan).toHaveBeenCalledWith('usb', onEvent);
  });

  it('scanForConnectionType(bluetooth) forwards to the tspl driver scan', () => {
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver }, createResourceLock());
    const onEvent = jest.fn();
    service.scanForConnectionType('bluetooth', onEvent);
    expect(tsplDriver.scan).toHaveBeenCalledWith('bluetooth', onEvent);
  });

  it('connectDraft() connects via the driver matching the given driver type without touching storage', async () => {
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver }, createResourceLock());
    const draftPrinter: Printer = { ...basePrinter, id: 'draft-1', drivers: [tsplDriverEntry] };
    await service.connectDraft(draftPrinter, tsplDriverEntry);
    expect(tsplDriver.connect).toHaveBeenCalledWith(draftPrinter, tsplDriverEntry);
    expect(service.getPrinters()).toEqual([]);
  });

  it('connect() runs the driver call through the connection lock, keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, lock);
    service.addPrinter(basePrinter);
    await service.connect(basePrinter.id);
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter, escposDriverEntry);
  });

  it('disconnect() runs the driver call through the connection lock, keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, lock);
    service.addPrinter(basePrinter);
    await service.disconnect(basePrinter.id);
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
    expect(escposDriver.disconnect).toHaveBeenCalledWith(basePrinter.id);
  });

  it('discoverDriver() forwards to createDiscoverDriver wired with the registry', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver }, createResourceLock());
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      service.discoverDriver({ printerId: 'p1', connectionType: 'lan', lan: { ip: '1.1.1.1', port: 9100 } }, (event) => {
        events.push(event.stage);
        if (event.stage === 'identified') resolve();
      });
    });
    expect(events).toEqual(['connecting', 'identifying', 'identified']);
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
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    const second: Printer = { ...basePrinter, id: 'p2', identityKey: 'lan:1.1.1.2:9100', lan: { ip: '1.1.1.2', port: 9100 } };
    service.addPrinter(basePrinter);
    service.addPrinter(second);
    await Promise.all([service.connect(basePrinter.id), service.connect(second.id)]);
    expect(maxInFlight).toBe(1);
  });
});

// src/features/printer/services/PrinterService.test.ts
import { createPrinterService } from '../PrinterService';
import { createResourceLock } from '../PrinterConnectionLock';
import { StorageService } from '../../../../services/StorageService';
import type { IPrinterDriver } from '../../types/driver.types';
import type { PrinterConfig } from '../../types/printer.types';

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const baseConfig: PrinterConfig = {
  id: 'p1',
  printerName: 'Máy in hóa đơn quầy 1',
  protocolSource: 'auto',
  protocol: 'escpos',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  enabled: true,
  lan: { ip: '192.168.1.10', port: 9100 },
};

describe('PrinterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The Jest-mocked MMKV store (jest.setup.js) is a module-level Map that
    // persists across tests within this file — clear the keys PrinterService
    // writes to so each test starts from a clean slate.
    StorageService.removeItem('printer.list');
    StorageService.removeItem('printer.defaultId');
  });

  it('addPrinter() persists and getPrinters() returns it back', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(baseConfig);
    expect(service.getPrinters()).toEqual([baseConfig]);
  });

  it('removePrinter() removes it from the list', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(baseConfig);
    service.removePrinter(baseConfig.id);
    expect(service.getPrinters()).toEqual([]);
  });

  it('setDefault() marks exactly one printer as default', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    const second: PrinterConfig = { ...baseConfig, id: 'p2' };
    service.addPrinter(baseConfig);
    service.addPrinter(second);
    service.setDefault('p2');
    expect(service.getDefaultPrinterId()).toBe('p2');
    expect(service.getPrinters().find((p) => p.id === 'p1')?.isDefault).toBe(false);
    expect(service.getPrinters().find((p) => p.id === 'p2')?.isDefault).toBe(true);
  });

  it('connect() forwards to the driver matching the printer protocol', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(baseConfig);
    await service.connect(baseConfig.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(baseConfig);
  });

  it('reconnect() disconnects then connects', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(baseConfig);
    await service.reconnect(baseConfig.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(baseConfig.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(baseConfig);
  });

  it('testPrint() forwards the given config straight to the driver, without persisting it', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    await service.testPrint(baseConfig);
    expect(escposDriver.testPrint).toHaveBeenCalledWith(baseConfig);
    expect(service.getPrinters()).toEqual([]);
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

  it('connectDraft() connects via the driver matching the draft config protocol without touching storage', async () => {
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver }, createResourceLock());
    const draft: PrinterConfig = { ...baseConfig, id: 'draft-1', protocol: 'tspl' };
    await service.connectDraft(draft);
    expect(tsplDriver.connect).toHaveBeenCalledWith(draft);
    expect(service.getPrinters()).toEqual([]);
  });

  it('discoverProtocol() forwards to createDiscoverProtocol wired with the registry', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver }, createResourceLock());
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      service.discoverProtocol({ printerId: 'p1', connectionType: 'lan', lan: { ip: '1.1.1.1', port: 9100 } }, (event) => {
        events.push(event.stage);
        if (event.stage === 'identified') resolve();
      });
    });
    expect(events).toEqual(['connecting', 'identifying', 'identified']);
  });

  it('setEnabled() updates enabled for that printer only', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    const second: PrinterConfig = { ...baseConfig, id: 'p2' };
    service.addPrinter(baseConfig);
    service.addPrinter(second);
    service.setEnabled('p1', false);
    expect(service.getPrinters().find((p) => p.id === 'p1')?.enabled).toBe(false);
    expect(service.getPrinters().find((p) => p.id === 'p2')?.enabled).toBe(true);
  });

  it('getPrinters() normalizes a stored printer with no enabled field to true', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    const legacyRecord = { ...baseConfig } as Partial<PrinterConfig>;
    delete legacyRecord.enabled;
    StorageService.setItem('printer.list', [legacyRecord]);
    expect(service.getPrinters()[0].enabled).toBe(true);
  });

  it('print() forwards to the driver matching the printer protocol', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(baseConfig);
    const document = { elements: [{ type: 'text' as const, content: 'x', x: 0, y: 0 }] };
    await service.print(baseConfig.id, document);
    expect(escposDriver.print).toHaveBeenCalledWith(baseConfig.id, document);
  });

  it('print() connects first when the driver reports the printer is not connected', async () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue('idle') });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(baseConfig);
    const document = { elements: [{ type: 'text' as const, content: 'x', x: 0, y: 0 }] };
    await service.print(baseConfig.id, document);
    expect(escposDriver.connect).toHaveBeenCalledWith(baseConfig);
    expect(escposDriver.print).toHaveBeenCalledWith(baseConfig.id, document);
  });

  it('print() does not reconnect when the driver reports the printer is already connected', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(baseConfig);
    const document = { elements: [{ type: 'text' as const, content: 'x', x: 0, y: 0 }] };
    await service.print(baseConfig.id, document);
    expect(escposDriver.connect).not.toHaveBeenCalled();
  });

  it('testPrint() runs the driver call through the connection lock, keyed by protocol+connectionType', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, lock);
    await service.testPrint(baseConfig);
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
    expect(escposDriver.testPrint).toHaveBeenCalledWith(baseConfig);
  });
});

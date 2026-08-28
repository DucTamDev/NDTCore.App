import { createPrinterService } from '../PrinterService';
import { createResourceLock } from '../PrinterConnectionLock';
import { PrinterStorage } from '../../storage/PrinterStorage';
import type { IPrinterDriver } from '../../types/driver.types';
import { ConnectionType, DriverSource, PrinterDriverType, PrinterStatus, TsplRenderMode, type Printer, type PrinterDriver } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';
import { DiscoveryStage } from '../../discovery/PrinterDiscoveryService';
import { AppErrorCode } from '../../types/AppError';
import { PrinterLogger } from '../../services/PrinterLogger';

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue(PrinterStatus.connected),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const escposDriverEntry: PrinterDriver = { type: PrinterDriverType.escpos, source: DriverSource.auto, contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos } };
const tsplDriverEntry: PrinterDriver = { type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap } };

const basePrinter: Printer = {
  id: 'p1',
  name: 'Máy in hóa đơn quầy 1',
  drivers: [escposDriverEntry],
  connectionType: ConnectionType.lan,
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

  it('addPrinter() recomputes identityKey from connection fields, overriding a wrong caller-supplied value', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    const staleIdentity: Printer = { ...basePrinter, identityKey: 'lan:9.9.9.9:1' };
    service.addPrinter(staleIdentity);
    expect(service.getPrinters()[0].identityKey).toBe('lan:192.168.1.10:9100');
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

  it('disconnect() disconnects every driver of the printer', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    await service.disconnect(twoDriverPrinter.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(twoDriverPrinter.id);
    expect(tsplDriver.disconnect).toHaveBeenCalledWith(twoDriverPrinter.id);
  });

  it('disconnect() does not let one driver failing block the other', async () => {
    const escposDriver = makeMockDriver({ disconnect: jest.fn().mockRejectedValue(new Error('offline')) });
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    await service.disconnect(twoDriverPrinter.id);
    expect(tsplDriver.disconnect).toHaveBeenCalled();
  });

  it('getStatus() returns connected when at least one driver of the printer is connected', () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.idle) });
    const tsplDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.connected) });
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    expect(service.getStatus(twoDriverPrinter.id)).toBe(PrinterStatus.connected);
  });

  it('getStatus() falls back to the first driver status when none are connected', () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.error) });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
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
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);

    const callback = jest.fn();
    const unsubscribe = service.onStatusChange(twoDriverPrinter.id, callback);

    tsplDriver.getStatus.mockReturnValue(PrinterStatus.connected);
    tsplCallback?.(PrinterStatus.connected);
    expect(callback).toHaveBeenCalledWith(PrinterStatus.connected);

    unsubscribe();
    expect(escposUnsubscribe).toHaveBeenCalled();
    expect(tsplUnsubscribe).toHaveBeenCalled();
  });

  it('print() forwards to the driver whose contentTypes includes the printType', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    const documents = { text: { elements: [] } };
    await service.print(twoDriverPrinter.id, documents, PrintType.Label);
    expect(tsplDriver.print).toHaveBeenCalledWith(twoDriverPrinter.id, documents, PrintType.Label);
    expect(escposDriver.print).not.toHaveBeenCalled();
  });

  it('print() forwards to the printer default driver, passing the printType through', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents, PrintType.Receipt);
    expect(escposDriver.print).toHaveBeenCalledWith(basePrinter.id, documents, PrintType.Receipt);
  });

  it('print() connects first when the driver reports the printer is not connected', async () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.idle) });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents, PrintType.Receipt);
    expect(escposDriver.connect).toHaveBeenCalledWith(basePrinter, escposDriverEntry);
    expect(escposDriver.print).toHaveBeenCalledWith(basePrinter.id, documents, PrintType.Receipt);
  });

  it('print() does not reconnect when the driver reports the printer is already connected', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const documents = { text: { elements: [] } };
    await service.print(basePrinter.id, documents, PrintType.Receipt);
    expect(escposDriver.connect).not.toHaveBeenCalled();
  });

  it('testPrint() forwards printer+driver+documents straight to the matching driver, without persisting it', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    const documents = { text: { elements: [] } };
    await service.testPrint(basePrinter, escposDriverEntry, documents, PrintType.Receipt);
    expect(escposDriver.testPrint).toHaveBeenCalledWith(basePrinter, escposDriverEntry, documents, PrintType.Receipt);
    expect(service.getPrinters()).toEqual([]);
  });

  it('testPrint() runs through the connection lock keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, lock);
    await service.testPrint(basePrinter, escposDriverEntry, { text: { elements: [] } }, PrintType.Receipt);
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
    service.scanForConnectionType(ConnectionType.usb, onEvent);
    expect(escposDriver.scan).toHaveBeenCalledWith(ConnectionType.usb, onEvent);
  });

  it('scanForConnectionType(bluetooth) forwards to the tspl driver scan', () => {
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver }, createResourceLock());
    const onEvent = jest.fn();
    service.scanForConnectionType(ConnectionType.bluetooth, onEvent);
    expect(tsplDriver.scan).toHaveBeenCalledWith(ConnectionType.bluetooth, onEvent);
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
      service.discoverDriver({ draftPrinter: { ...basePrinter, drivers: [] } }, (event) => {
        events.push(event.stage);
        if (event.stage === DiscoveryStage.identified) resolve();
      });
    });
    expect(events).toEqual([DiscoveryStage.connecting, DiscoveryStage.identifying, DiscoveryStage.identified]);
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

  it('installTsplFont() delegates to the tspl driver instance directly (not through the generic IPrinterDriver interface)', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont('p1', font);

    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith('p1', font);
  });

  it('installTsplFont() runs the driver call through the connection lock, keyed by connectionResourceKey, for a saved printer', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, lock);
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(twoDriverPrinter.id, font);

    expect(runExclusiveSpy).toHaveBeenCalledWith('tspl:lan:192.168.1.10:9100', expect.any(Function));
    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith(twoDriverPrinter.id, font);
  });

  it('installTsplFont() is actually mutually exclusive — two concurrent calls on the same printer never overlap the driver write', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const tsplDriver = {
      ...makeMockDriver(),
      installTsplFont: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
    };
    const lock = createResourceLock();
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, lock);
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await Promise.all([
      service.installTsplFont(twoDriverPrinter.id, font),
      service.installTsplFont(twoDriverPrinter.id, font),
    ]);

    expect(maxInFlight).toBe(1);
  });

  it('installTsplFont() falls back to the bare printerId as the lock key for a draft (unsaved) printer', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, lock);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont('draft-not-saved', font);

    expect(runExclusiveSpy).toHaveBeenCalledWith('draft-not-saved', expect.any(Function));
    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith('draft-not-saved', font);
  });

  it('installTsplFont() connects then disconnects around the DOWNLOAD when the driver was not already connected', async () => {
    const tsplDriver = { ...makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.idle) }), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    service.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(tsplPrinter.id, font);

    expect(tsplDriver.connect).toHaveBeenCalledWith(tsplPrinter, tsplDriverEntry);
    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith(tsplPrinter.id, font);
    expect(tsplDriver.disconnect).toHaveBeenCalledWith(tsplPrinter.id);
  });

  it('installTsplFont() does not touch a pre-existing connection (§95 Driver Connect Reuse)', async () => {
    const tsplDriver = { ...makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.connected) }), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    service.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(tsplPrinter.id, font);

    expect(tsplDriver.connect).not.toHaveBeenCalled();
    expect(tsplDriver.disconnect).not.toHaveBeenCalled();
  });

  it('installTsplFont() persists renderMode=truetype + font.fontInstalled=true for a saved printer', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    service.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(tsplPrinter.id, font);

    const savedTspl = service.getPrinters().find((p) => p.id === tsplPrinter.id)!.drivers.find((d) => d.type === PrinterDriverType.tspl)!;
    expect(savedTspl.config).toMatchObject({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } });
  });

  it('installTsplFont() for a draft (unsaved but already connected) resolves without writing storage', async () => {
    const tsplDriver = { ...makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.connected) }), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };
    const before = service.getPrinters().length;

    await expect(service.installTsplFont('draft-xyz', font)).resolves.toBeUndefined();

    expect(service.getPrinters().length).toBe(before);
    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith('draft-xyz', font);
  });

  it('installTsplFont() throws PRINTER_NOT_CONNECTED for an unknown printer the driver reports as not connected', async () => {
    const tsplDriver = { ...makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.idle) }), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await expect(service.installTsplFont('ghost', font)).rejects.toMatchObject({ code: AppErrorCode.PRINTER_NOT_CONNECTED });
    expect(tsplDriver.installTsplFont).not.toHaveBeenCalled();
  });

  it('print() / testPrint() / reconnect() never invoke the tspl driver installTsplFont (RULE 15-17)', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    const documents = { text: { elements: [] } };

    await service.print(twoDriverPrinter.id, documents, PrintType.Label);
    await service.testPrint(twoDriverPrinter, tsplDriverEntry, documents, PrintType.Label);
    await service.reconnect(twoDriverPrinter.id);

    expect(tsplDriver.installTsplFont).not.toHaveBeenCalled();
  });

  it('installTsplFont() calls PrinterLogger.fontInstallSucceeded after a successful install', async () => {
    const succeededSpy = jest.spyOn(PrinterLogger, 'fontInstallSucceeded').mockImplementation(() => undefined);
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    service.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(tsplPrinter.id, font);

    expect(succeededSpy).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: tsplPrinter.id, connectionType: ConnectionType.lan }),
    );
    succeededSpy.mockRestore();
  });

  it('installTsplFont() calls PrinterLogger.fontInstallFailed then rethrows when the DOWNLOAD fails', async () => {
    const failedSpy = jest.spyOn(PrinterLogger, 'fontInstallFailed').mockImplementation(() => undefined);
    const downloadError = new Error('download timed out');
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockRejectedValue(downloadError) };
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    service.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await expect(service.installTsplFont(tsplPrinter.id, font)).rejects.toThrow('download timed out');
    expect(failedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: tsplPrinter.id, errorCode: expect.any(String) }),
    );
    failedSpy.mockRestore();
  });
});

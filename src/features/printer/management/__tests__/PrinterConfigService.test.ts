import { createPrinterConfigService } from '../PrinterConfigService';
import { createPrinterRepository } from '../../storage/PrinterRepository';
import { createResourceLock } from '../../connection/PrinterConnectionLock';
import { PrinterStorage } from '../../storage/PrinterStorage';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { PrintRenderMode, PrinterDriverType } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { type Printer } from '../../models/printer/Printer';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { PrinterLogger } from '../../logging/PrinterLogger';
import { makeMockDriver, escposDriverEntry, tsplDriverEntry, basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterConfigService', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it('installTsplFont() delegates to the tspl driver instance directly (not through the generic IPrinterDriver interface)', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont('p1', font);

    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith('p1', font);
  });

  it('installTsplFont() runs the driver call through the connection lock, keyed by connectionResourceKey, for a saved printer', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, lock);
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
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
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, lock);
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    repository.addPrinter(twoDriverPrinter);
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
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, lock);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont('draft-not-saved', font);

    expect(runExclusiveSpy).toHaveBeenCalledWith('draft-not-saved', expect.any(Function));
    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith('draft-not-saved', font);
  });

  it('installTsplFont() connects then disconnects around the DOWNLOAD when the driver was not already connected', async () => {
    const tsplDriver = { ...makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.idle) }), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    repository.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(tsplPrinter.id, font);

    expect(tsplDriver.connect).toHaveBeenCalledWith(tsplPrinter, tsplDriverEntry);
    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith(tsplPrinter.id, font);
    expect(tsplDriver.disconnect).toHaveBeenCalledWith(tsplPrinter.id);
  });

  it('installTsplFont() does not touch a pre-existing connection (§95 Driver Connect Reuse)', async () => {
    const tsplDriver = { ...makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.connected) }), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    repository.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(tsplPrinter.id, font);

    expect(tsplDriver.connect).not.toHaveBeenCalled();
    expect(tsplDriver.disconnect).not.toHaveBeenCalled();
  });

  it('installTsplFont() persists renderMode=truetype + font.fontInstalled=true for a saved printer', async () => {
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    repository.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(tsplPrinter.id, font);

    const savedTspl = repository.getPrinters().find((p) => p.id === tsplPrinter.id)!.drivers.find((d) => d.type === PrinterDriverType.tspl)!;
    expect(savedTspl.config).toMatchObject({ type: PrinterDriverType.tspl, renderMode: PrintRenderMode.truetype, font: { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } });
  });

  it('setTsplRenderMode() persists renderMode=bitmap for a saved TSPL printer (symmetric with the TrueType toggle-off)', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    const tsplPrinter: Printer = {
      ...basePrinter,
      drivers: [
        {
          ...tsplDriverEntry,
          config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.truetype, media: { type: 'continuous', paperSize: 80 }, font: { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
        },
      ],
    };
    repository.addPrinter(tsplPrinter);

    service.setTsplRenderMode(tsplPrinter.id, PrintRenderMode.bitmap);

    const savedTspl = repository.getPrinters().find((p) => p.id === tsplPrinter.id)!.drivers.find((d) => d.type === PrinterDriverType.tspl)!;
    expect(savedTspl.config).toMatchObject({ type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, font: { fontInstalled: true } });
  });

  it('setTsplRenderMode() is a no-op for a draft (unsaved) printer', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    expect(() => service.setTsplRenderMode('draft-not-saved', PrintRenderMode.bitmap)).not.toThrow();
    expect(repository.getPrinters()).toEqual([]);
  });

  it('setEscPosRenderMode() persists renderMode=bitmap for a saved ESC/POS printer', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    const escposPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry] };
    repository.addPrinter(escposPrinter);

    service.setEscPosRenderMode(escposPrinter.id, PrintRenderMode.bitmap);

    const savedEscpos = repository.getPrinters().find((p) => p.id === escposPrinter.id)!.drivers.find((d) => d.type === PrinterDriverType.escpos)!;
    expect(savedEscpos.config).toMatchObject({ type: PrinterDriverType.escpos, renderMode: PrintRenderMode.bitmap });
  });

  it('setEscPosRenderMode() is a no-op for a draft (unsaved) printer', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    expect(() => service.setEscPosRenderMode('draft-not-saved', PrintRenderMode.bitmap)).not.toThrow();
    expect(repository.getPrinters()).toEqual([]);
  });

  it('setTsplInternalFont() persists renderMode=internalfont + internalFont for a saved TSPL printer', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    repository.addPrinter(tsplPrinter);

    service.setTsplInternalFont(tsplPrinter.id, { codepage: '1258', fontName: 'TSS24.BF2' });

    const savedTspl = repository.getPrinters().find((p) => p.id === tsplPrinter.id)!.drivers.find((d) => d.type === PrinterDriverType.tspl)!;
    expect(savedTspl.config).toMatchObject({
      type: PrinterDriverType.tspl,
      renderMode: PrintRenderMode.internalfont,
      internalFont: { codepage: '1258', fontName: 'TSS24.BF2' },
    });
  });

  it('setTsplInternalFont() is a no-op for a draft (unsaved) printer', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    expect(() => service.setTsplInternalFont('draft-not-saved', { codepage: '1258', fontName: '3' })).not.toThrow();
    expect(repository.getPrinters()).toEqual([]);
  });

  it('installTsplFont() for a draft (unsaved but already connected) resolves without writing storage', async () => {
    const tsplDriver = { ...makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.connected) }), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };
    const before = repository.getPrinters().length;

    await expect(service.installTsplFont('draft-xyz', font)).resolves.toBeUndefined();

    expect(repository.getPrinters().length).toBe(before);
    expect(tsplDriver.installTsplFont).toHaveBeenCalledWith('draft-xyz', font);
  });

  it('installTsplFont() throws PRINTER_NOT_CONNECTED for an unknown printer the driver reports as not connected', async () => {
    const tsplDriver = { ...makeMockDriver({ getStatus: jest.fn().mockReturnValue(PrinterStatus.idle) }), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await expect(service.installTsplFont('ghost', font)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
    expect(tsplDriver.installTsplFont).not.toHaveBeenCalled();
  });

  it('setDriverMedia() persist media patch cho tspl driver của printer đã lưu', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter({ ...basePrinter, drivers: [tsplDriverEntry] });
    service.setDriverMedia(basePrinter.id, PrinterDriverType.tspl, { paperSize: 100 });
    const saved = repository.getPrinters()[0].drivers.find((d) => d.type === PrinterDriverType.tspl)!;
    expect(saved.config.media).toMatchObject({ type: 'continuous', paperSize: 100 });
  });

  it('setDriverMedia() cho escpos driver', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    repository.addPrinter(basePrinter);
    service.setDriverMedia(basePrinter.id, PrinterDriverType.escpos, { paperSize: 58 });
    expect(repository.getPrinters()[0].drivers[0].config.media.paperSize).toBe(58);
  });

  it('setDriverMedia() no-op cho printer chưa lưu', () => {
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, repository, createResourceLock());
    expect(() => service.setDriverMedia('not-saved', PrinterDriverType.tspl, { paperSize: 100 })).not.toThrow();
  });

  it('installTsplFont() calls PrinterLogger.fontInstallSucceeded after a successful install', async () => {
    const succeededSpy = jest.spyOn(PrinterLogger, 'fontInstallSucceeded').mockImplementation(() => undefined);
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockResolvedValue(undefined) };
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    repository.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await service.installTsplFont(tsplPrinter.id, font);

    expect(succeededSpy).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: tsplPrinter.id, connectionType: PrinterConnectionType.Lan }),
    );
    succeededSpy.mockRestore();
  });

  it('installTsplFont() calls PrinterLogger.fontInstallFailed then rethrows when the DOWNLOAD fails', async () => {
    const failedSpy = jest.spyOn(PrinterLogger, 'fontInstallFailed').mockImplementation(() => undefined);
    const downloadError = new Error('download timed out');
    const tsplDriver = { ...makeMockDriver(), installTsplFont: jest.fn().mockRejectedValue(downloadError) };
    const repository = createPrinterRepository();
    const service = createPrinterConfigService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, repository, createResourceLock());
    const tsplPrinter: Printer = { ...basePrinter, drivers: [tsplDriverEntry] };
    repository.addPrinter(tsplPrinter);
    const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

    await expect(service.installTsplFont(tsplPrinter.id, font)).rejects.toThrow('download timed out');
    expect(failedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: tsplPrinter.id, errorCode: expect.any(String) }),
    );
    failedSpy.mockRestore();
  });
});

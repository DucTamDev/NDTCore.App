import type { IPrinterDriver } from '../driver.types';
import { ConnectionType, CutterMode, DriverSource, mediaOf, paperSizeOf, PrinterDriverType, PrinterStatus, PrintMediaType, tsplRenderModeOf, TsplRenderMode, type Printer, type PrinterDriver } from '../printer.types';
import { PrintType } from '../printConfiguration.types';

describe('printer domain types', () => {
  it('accepts a fully-formed Printer with a single tspl driver for a LAN label printer', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: DriverSource.auto,
      contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: 'continuous', paperSize: 58 } },
    };
    const printer: Printer = {
      id: 'p1',
      name: 'Máy in tem quầy 1',
      drivers: [driver],
      connectionType: ConnectionType.lan,
      lan: { ip: '192.168.1.50', port: 9100 },
      identityKey: 'lan:192.168.1.50:9100',
      capabilities: { cutter: false },
      autoReconnect: true,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.drivers[0].type).toBe(PrinterDriverType.tspl);
  });

  it('accepts a Printer with two drivers (escpos + tspl) over the same physical connection', () => {
    const printer: Printer = {
      id: 'p1',
      name: 'Máy in đa năng',
      drivers: [
        { type: PrinterDriverType.escpos, source: DriverSource.auto, contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 80 } } },
        { type: PrinterDriverType.tspl, source: DriverSource.manual, contentTypes: [PrintType.Label], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } } },
      ],
      connectionType: ConnectionType.usb,
      device: { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} },
      identityKey: 'usb:1155:22222',
      capabilities: { cutter: false },
      autoReconnect: false,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.drivers).toHaveLength(2);
  });

  it('mediaOf/paperSizeOf đọc media của driver entry', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 } },
    };
    expect(paperSizeOf(driver)).toBe(100);
    expect(mediaOf(driver).columns).toBe(3);
  });

  it('CutterMode có đủ 3 giá trị', () => {
    expect([CutterMode.none, CutterMode.perJob, CutterMode.perRow]).toEqual(['none', 'per_job', 'per_row']);
  });

  it('a mock driver satisfies IPrinterDriver', () => {
    const driver: IPrinterDriver = {
      scan: () => () => undefined,
      connect: async () => undefined,
      disconnect: async () => undefined,
      getStatus: () => PrinterStatus.idle,
      onStatusChange: () => () => undefined,
      testPrint: async () => undefined,
      print: async () => undefined,
      identify: async () => null,
    };
    expect(driver.getStatus('p1')).toBe(PrinterStatus.idle);
  });
});

describe('tsplRenderModeOf', () => {
  const tspl = (renderMode: TsplRenderMode) => ({ type: PrinterDriverType.tspl, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.tspl, renderMode } } as never);
  it('trả renderMode đã cấu hình (không quan tâm fontInstalled)', () => {
    expect(tsplRenderModeOf(tspl(TsplRenderMode.truetype))).toBe(TsplRenderMode.truetype);
    expect(tsplRenderModeOf(tspl(TsplRenderMode.bitmap))).toBe(TsplRenderMode.bitmap);
  });
  it('trả null cho driver escpos', () => {
    expect(tsplRenderModeOf({ type: PrinterDriverType.escpos, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.escpos } } as never)).toBeNull();
  });
});

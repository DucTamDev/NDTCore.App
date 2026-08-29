import type { IPrinterDriver } from '../driver.types';
import { ConnectionType, DriverSource, PrinterDriverType, PrinterStatus, tsplRenderModeOf, TsplRenderMode, type Printer, type PrinterDriver } from '../printer.types';
import { PrintType } from '../printConfiguration.types';

describe('printer domain types', () => {
  it('accepts a fully-formed Printer with a single tspl driver for a LAN label printer', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: DriverSource.auto,
      contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap },
    };
    const printer: Printer = {
      id: 'p1',
      name: 'Máy in tem quầy 1',
      drivers: [driver],
      connectionType: ConnectionType.lan,
      lan: { ip: '192.168.1.50', port: 9100 },
      identityKey: 'lan:192.168.1.50:9100',
      paperSize: 58,
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
        { type: PrinterDriverType.escpos, source: DriverSource.auto, contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos } },
        { type: PrinterDriverType.tspl, source: DriverSource.manual, contentTypes: [PrintType.Label], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap } },
      ],
      connectionType: ConnectionType.usb,
      device: { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} },
      identityKey: 'usb:1155:22222',
      paperSize: 80,
      autoReconnect: false,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.drivers).toHaveLength(2);
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

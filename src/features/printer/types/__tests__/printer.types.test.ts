import type { IPrinterDriver } from '../../drivers/IPrinterDriver';
import { ConnectionType } from '../../models/printer/PrinterDevice';
import { DriverSource, PrinterDriverType, TsplRenderMode, type PrinterDriver } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { type Printer } from '../printer.types';
import { CutterMode } from '../../models/media/PrintMedia';
import { PrintType } from '../../models/printing/PrintType';

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

import { PrinterConnectionType } from '../PrinterConnection';
import { DriverSource, PrinterDriverType, PrintRenderMode, type PrinterDriver } from '../PrinterDriver';
import { type Printer } from '../Printer';
import { PrintType } from '../../printing/PrintType';

describe('Printer domain type', () => {
  it('accepts a fully-formed Printer with a single tspl driver for a LAN label printer', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: DriverSource.auto,
      contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, media: { type: 'continuous', paperSize: 58 } },
    };
    const printer: Printer = {
      id: 'p1',
      name: 'Máy in tem quầy 1',
      drivers: [driver],
      connection: { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 },
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
        { type: PrinterDriverType.tspl, source: DriverSource.manual, contentTypes: [PrintType.Label], config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } } },
      ],
      connection: { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 },
      identityKey: 'usb:1155:22222',
      capabilities: { cutter: false },
      autoReconnect: false,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.drivers).toHaveLength(2);
  });
});

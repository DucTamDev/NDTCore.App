import { PrinterConnectionType } from '../PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode, type PrinterDriver } from '../PrinterDriver';
import { type Printer } from '../Printer';
import { PrintType } from '../../printing/PrintType';
import { PaperSize, PrintPaperType } from '../../paper/PrintPaperConfig';

describe('Printer domain type', () => {
  it('accepts a fully-formed Printer with a tspl driver for a LAN label printer', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.Tspl,
      source: DriverSource.Auto,
      config: { renderMode: RenderMode.Bitmap },
    };
    const printer: Printer = {
      id: 'p1',
      identityKey: 'lan:192.168.1.50:9100',
      type: PrintType.Label,
      name: 'Máy in tem quầy 1',
      driver,
      connection: { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 },
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm58 },
      capabilities: { cutter: false },
      autoReconnect: true,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.driver.type).toBe(PrinterDriverType.Tspl);
  });

  it('accepts a Printer with a single escpos driver over USB', () => {
    const printer: Printer = {
      id: 'p1',
      identityKey: 'usb:1155:22222',
      type: PrintType.Receipt,
      name: 'Máy in hóa đơn quầy 1',
      driver: { type: PrinterDriverType.EscPos, source: DriverSource.Manual, config: { renderMode: RenderMode.Encoder } },
      connection: { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 },
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 },
      capabilities: { cutter: false },
      autoReconnect: false,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.driver.type).toBe(PrinterDriverType.EscPos);
  });
});

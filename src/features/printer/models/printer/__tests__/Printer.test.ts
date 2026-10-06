import { ConnectionType } from '../../connections/ConnectionType';
import { LanguageSelection, PrintLanguage, type PrinterLanguage } from '../PrinterLanguage';
import { type Printer } from '../Printer';
import { PrintKind } from '../PrintKind';
import { CutterMode } from '../../paper/CutterMode';
import { PaperSize } from '../../paper/PaperSize';
import { PaperType } from '../../paper/PaperType';

describe('Printer domain type', () => {
  it('accepts a fully-formed Printer with a TSPL language for a LAN label printer', () => {
    const language: PrinterLanguage = {
      type: PrintLanguage.Tspl,
      selection: LanguageSelection.Auto,
    };
    const printer: Printer = {
      id: 'p1',
      deviceId: 'lan:192.168.1.50:9100',
      kind: PrintKind.Label,
      name: 'Máy in tem quầy 1',
      language,
      connection: { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 },
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.PerJob },
      capabilities: { cutter: false, cashDrawer: false, color: false, image: false },
      autoReconnect: true,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.language.type).toBe(PrintLanguage.Tspl);
  });

  it('accepts a Printer with an ESC/POS language over USB', () => {
    const printer: Printer = {
      id: 'p1',
      deviceId: 'usb:1155:22222',
      kind: PrintKind.Receipt,
      name: 'Máy in hóa đơn quầy 1',
      language: {
        type: PrintLanguage.EscPos,
        selection: LanguageSelection.Manual,
      },
      connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 },
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob },
      capabilities: { cutter: false, cashDrawer: false, color: false, image: false },
      autoReconnect: false,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.language.type).toBe(PrintLanguage.EscPos);
  });
});

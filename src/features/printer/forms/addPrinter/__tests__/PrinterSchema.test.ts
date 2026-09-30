import { printerSchema } from '../PrinterSchema';
import { PrinterConnectionType } from '../../../models/printer/PrinterConnection';
import { RenderMode, BitmapSource } from '../../../models/printer/PrinterDriver';
import { CutterMode, PaperSize, PrintPaperType } from '../../../models/paper/PrintPaperConfig';
import { PrintType } from '../../../models/printing/PrintType';
import { makePrinter, makeEscPosDriver, makeTsplDriver } from '../../../testing/printerFixtures';

describe('printerSchema', () => {
  it('accepts a fully valid printer with the new atomic shape', () => {
    expect(printerSchema.safeParse(makePrinter()).success).toBe(true);
  });

  it('rejects ESC/POS driver + paper.type DieCut', () => {
    const printer = makePrinter({
      driver: makeEscPosDriver(),
      paper: {
        type: PrintPaperType.DieCut,
        paperSize: PaperSize.Mm80,
        itemWidthMm: 30,
        itemHeightMm: 20,
        columns: 2,
        horizontalGapMm: 2,
        verticalGapMm: 2,
      },
    });
    const result = printerSchema.safeParse(printer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'ESC/POS chỉ in giấy cuộn liên tục')).toBe(true);
    }
  });

  it('accepts TSPL driver with driver.config.renderMode Encoder', () => {
    const printer = makePrinter({
      driver: makeTsplDriver({ config: { renderMode: RenderMode.Encoder } }),
    });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts TSPL driver with bitmapSource Ast when renderMode is Bitmap', () => {
    const printer = makePrinter({
      driver: makeTsplDriver({ config: { renderMode: RenderMode.Bitmap, bitmapSource: BitmapSource.Ast } }),
    });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts a driver config with no bitmapSource at all (defaults to Image downstream)', () => {
    const printer = makePrinter({ driver: makeEscPosDriver({ config: { renderMode: RenderMode.Bitmap } }) });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('rejects die-cut paper missing a required field', () => {
    const printer = makePrinter({
      driver: makeTsplDriver(),
      paper: {
        type: PrintPaperType.DieCut,
        paperSize: PaperSize.Mm100,
        itemWidthMm: 30,
        itemHeightMm: 20,
        columns: 3,
        horizontalGapMm: 2,
        // thiếu verticalGapMm
      },
    });
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects die-cut paper with cutterMode other than None', () => {
    const printer = makePrinter({
      driver: makeTsplDriver(),
      paper: {
        type: PrintPaperType.DieCut,
        paperSize: PaperSize.Mm100,
        itemWidthMm: 30,
        itemHeightMm: 20,
        columns: 3,
        horizontalGapMm: 2,
        verticalGapMm: 3,
        cutterMode: CutterMode.PerJob,
      },
    });
    const result = printerSchema.safeParse(printer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'paper.cutterMode')).toBe(true);
    }
  });

  it('rejects ESC/POS driver + type Label (ESC/POS chỉ phục vụ Receipt)', () => {
    const printer = makePrinter({ driver: makeEscPosDriver(), type: PrintType.Label });
    const result = printerSchema.safeParse(printer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'driver.type')).toBe(true);
    }
  });

  it('accepts connection.type Usb với đúng field usb (vendorId/productId)', () => {
    const printer = makePrinter({ connection: { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 } });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts connection.type Bluetooth với đúng field bluetooth (deviceId)', () => {
    const printer = makePrinter({ connection: { type: PrinterConnectionType.Bluetooth, deviceId: '00:11:22:33:44:55' } });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts connection.type Lan với đúng field lan (host/port)', () => {
    const printer = makePrinter({ connection: { type: PrinterConnectionType.Lan, host: '192.168.1.20', port: 9100 } });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('rejects connection thiếu field bắt buộc của variant (usb thiếu productId)', () => {
    const printer = { ...makePrinter(), connection: { type: PrinterConnectionType.Usb, vendorId: 1155 } };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });
});

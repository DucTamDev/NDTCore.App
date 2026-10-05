import { printerSchema } from '../PrinterSchema';
import { ConnectionType } from '../../../models/printer/ConnectionType';
import { PaperSize } from '../../../models/paper/PaperSize';
import { PaperType } from '../../../models/paper/PaperType';
import type { PaperOptions } from '../../../models/paper/PaperOptions';
import { PrintKind } from '../../../models/printer/PrintKind';
import { makePrinter, makeEscPosLanguage, makeTsplLanguage } from '../../../testing/printerFixtures';

describe('printerSchema', () => {
  it('accepts a fully valid printer with the new atomic shape', () => {
    expect(printerSchema.safeParse(makePrinter()).success).toBe(true);
  });

  it('rejects ESC/POS language + paper.type DieCut', () => {
    const printer = makePrinter({
      language: makeEscPosLanguage(),
      paper: {
        type: PaperType.DieCut,
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

  it('accepts a TSPL language', () => {
    const printer = makePrinter({ language: makeTsplLanguage() });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts an ESC/POS language', () => {
    const printer = makePrinter({ language: makeEscPosLanguage() });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('rejects die-cut paper missing a required field', () => {
    const printer = makePrinter({
      language: makeTsplLanguage(),
      paper: {
        type: PaperType.DieCut,
        paperSize: PaperSize.Mm100,
        itemWidthMm: 30,
        itemHeightMm: 20,
        columns: 3,
        horizontalGapMm: 2,
        // thiếu verticalGapMm; dữ liệu không qua kiểu (vd đọc từ bộ nhớ) vẫn phải bị chặn.
      } as unknown as PaperOptions,
    });
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects ESC/POS + kind Label (ESC/POS chỉ in Receipt)', () => {
    const printer = makePrinter({ language: makeEscPosLanguage(), kind: PrintKind.Label });
    const result = printerSchema.safeParse(printer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'language.type')).toBe(true);
    }
  });

  it('accepts connection.type Usb với đúng field usb (vendorId/productId)', () => {
    const printer = makePrinter({ connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 } });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts connection.type Bluetooth với đúng field bluetooth (mac)', () => {
    const printer = makePrinter({ connection: { type: ConnectionType.Bluetooth, mac: '00:11:22:33:44:55' } });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts connection.type Lan với đúng field lan (host/port)', () => {
    const printer = makePrinter({ connection: { type: ConnectionType.Lan, host: '192.168.1.20', port: 9100 } });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('rejects connection thiếu field bắt buộc của variant (usb thiếu productId)', () => {
    const printer = { ...makePrinter(), connection: { type: ConnectionType.Usb, vendorId: 1155 } };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });
});

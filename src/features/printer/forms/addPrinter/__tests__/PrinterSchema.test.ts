import { printerDriverSchema, printerSchema } from '../PrinterSchema';
import { PrinterConnectionType } from '../../../models/printer/PrinterConnection';
import { DriverSource, PrintRenderMode, PrinterDriverType, type PrinterDriver } from '../../../models/printer/PrinterDriver';
import { type Printer } from '../../../models/printer/Printer';
import { PrintType } from '../../../models/printing/PrintType';
import { makePrinter, makeTsplDriverEntry, makeEscPosDriverEntry } from '../../../testing/printerFixtures';

const MEDIA = { type: 'continuous', paperSize: 80 } as const;

const escposDriver: PrinterDriver = {
  type: PrinterDriverType.escpos,
  source: DriverSource.auto,
  contentTypes: [PrintType.Receipt],
  config: { type: PrinterDriverType.escpos, media: { ...MEDIA } },
};
const tsplDriver: PrinterDriver = {
  type: PrinterDriverType.tspl,
  source: DriverSource.auto,
  contentTypes: [PrintType.Label],
  config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, media: { ...MEDIA } },
};

const basePrinter: Printer = {
  id: 'p1',
  name: 'Máy in',
  drivers: [escposDriver],
  connection: { type: PrinterConnectionType.Lan, host: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('printerDriverSchema', () => {
  it('accepts an escpos driver with only Receipt', () => {
    expect(printerDriverSchema.safeParse(escposDriver).success).toBe(true);
  });

  it('rejects an escpos driver assigned Label (outside its capability)', () => {
    const invalid: PrinterDriver = { ...escposDriver, contentTypes: [PrintType.Label] };
    expect(printerDriverSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects a driver whose config.type does not match driver.type', () => {
    const mismatched = { ...escposDriver, config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, media: { ...MEDIA } } };
    expect(printerDriverSchema.safeParse(mismatched).success).toBe(false);
  });

  it('accepts an escpos driver without renderMode (undefined ⇒ text, tương thích ngược)', () => {
    expect(printerDriverSchema.safeParse(escposDriver).success).toBe(true);
  });

  it('accepts an escpos driver with renderMode text', () => {
    const driver: PrinterDriver = { ...escposDriver, config: { type: PrinterDriverType.escpos, renderMode: PrintRenderMode.encoder, media: { ...MEDIA } } };
    expect(printerDriverSchema.safeParse(driver).success).toBe(true);
  });

  it('accepts an escpos driver with renderMode bitmap', () => {
    const driver: PrinterDriver = { ...escposDriver, config: { type: PrinterDriverType.escpos, renderMode: PrintRenderMode.bitmap, media: { ...MEDIA } } };
    expect(printerDriverSchema.safeParse(driver).success).toBe(true);
  });

  it('rejects an escpos driver with an invalid renderMode value', () => {
    const driver = { ...escposDriver, config: { type: PrinterDriverType.escpos, renderMode: 'internalfont', media: { ...MEDIA } } };
    expect(printerDriverSchema.safeParse(driver).success).toBe(false);
  });

  it('accepts a tspl driver with renderMode bitmap and no font', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: DriverSource.auto,
      contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, media: { ...MEDIA } },
    };
    expect(printerDriverSchema.safeParse(driver).success).toBe(true);
  });

  it('accepts a tspl driver with renderMode truetype and a valid font config', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.truetype, media: { ...MEDIA }, font: { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
    };
    expect(printerDriverSchema.safeParse(driver).success).toBe(true);
  });

  it('rejects a font name containing invalid characters', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.truetype, media: { ...MEDIA }, font: { name: 'VIET FONT"', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
    };
    expect(printerDriverSchema.safeParse(driver).success).toBe(false);
  });

  it('rejects an empty font name', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.truetype, media: { ...MEDIA }, font: { name: '', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
    };
    expect(printerDriverSchema.safeParse(driver).success).toBe(false);
  });
});

describe('printerSchema', () => {
  it('accepts a valid single-driver LAN printer', () => {
    expect(printerSchema.safeParse(basePrinter).success).toBe(true);
  });

  it('accepts a valid two-driver printer with disjoint content types', () => {
    const printer: Printer = { ...basePrinter, drivers: [escposDriver, tsplDriver] };
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('rejects two drivers that both claim Receipt (invariant #3)', () => {
    const overlapping: PrinterDriver = { ...tsplDriver, contentTypes: [PrintType.Receipt] };
    const printer: Printer = { ...basePrinter, drivers: [escposDriver, overlapping] };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects two drivers of the same type on one printer', () => {
    // Cả 2 driver cùng type 'tspl', contentTypes RỜI NHAU và hợp lệ riêng lẻ —
    // để chỉ có rule "không được có 2 driver cùng type" là lý do fail, không
    // bị lẫn với rule contentTypes trùng nhau hay rule min(1).
    const firstTspl: PrinterDriver = { ...tsplDriver, contentTypes: [PrintType.Receipt] };
    const secondTspl: PrinterDriver = { ...tsplDriver, contentTypes: [PrintType.Label] };
    const printer: Printer = { ...basePrinter, drivers: [firstTspl, secondTspl] };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects zero drivers (invariant #10)', () => {
    const printer: Printer = { ...basePrinter, drivers: [] };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects three drivers (max 2, invariant #2)', () => {
    const printer: Printer = { ...basePrinter, drivers: [escposDriver, tsplDriver, { ...escposDriver, contentTypes: [] }] };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  /**
   * `PrinterConnection` là discriminated union (invariant #13 giờ được TypeScript
   * + `z.discriminatedUnion` enforce cấu trúc, không còn cross-field check thủ
   * công cho "lan có device"/"usb có lan" — những trạng thái đó nay không thể
   * biểu diễn được nữa, không cần test runtime-reject riêng).
   */
  it('accepts connection.type usb với đúng field usb (vendorId/productId)', () => {
    const printer: Printer = { ...basePrinter, connection: { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 } };
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts connection.type bluetooth với đúng field bluetooth (deviceId)', () => {
    const printer: Printer = { ...basePrinter, connection: { type: PrinterConnectionType.Bluetooth, deviceId: '00:11:22:33:44:55' } };
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('rejects connection thiếu field bắt buộc của variant (usb thiếu productId)', () => {
    const printer = { ...basePrinter, connection: { type: PrinterConnectionType.Usb, vendorId: 1155 } };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });
});

describe('printMediaSchema (qua printerSchema)', () => {
  const withTsplMedia = (media: unknown) =>
    printerSchema.safeParse(makePrinter({
      drivers: [{ ...makeTsplDriverEntry(), config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, media } as never }],
    }));

  it('continuous chỉ cần type + paperSize', () => {
    expect(withTsplMedia({ type: 'continuous', paperSize: 80 }).success).toBe(true);
  });

  it('paperSize 100 hợp lệ', () => {
    expect(withTsplMedia({ type: 'continuous', paperSize: 100 }).success).toBe(true);
  });

  it('die_cut thiếu columns/itemWidthMm/... → fail', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100 }).success).toBe(false);
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2 }).success).toBe(false); // thiếu verticalGapMm
  });

  it('die_cut đủ field → pass', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 }).success).toBe(true);
  });

  it('die_cut + cutterMode != none → fail', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, cutterMode: 'per_job' }).success).toBe(false);
  });

  it('columns < 1 → fail', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 0, horizontalGapMm: 2, verticalGapMm: 3 }).success).toBe(false);
  });

  it('die_cut vượt khổ giấy → fail', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 4, horizontalGapMm: 2, verticalGapMm: 3 }).success).toBe(false);
  });

  it('die_cut vừa khổ giấy → pass', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 }).success).toBe(true);
  });
});

describe('ESC/POS media phải continuous', () => {
  it('escpos + media.type die_cut → fail', () => {
    const p = makePrinter({
      drivers: [{ ...makeEscPosDriverEntry(), config: { type: PrinterDriverType.escpos, media: { type: 'die_cut', paperSize: 80, itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 2 } } as never }],
    });
    expect(printerSchema.safeParse(p).success).toBe(false);
  });

  it('escpos + media.type continuous → pass', () => {
    expect(printerSchema.safeParse(makePrinter({ drivers: [makeEscPosDriverEntry()] })).success).toBe(true);
  });
});

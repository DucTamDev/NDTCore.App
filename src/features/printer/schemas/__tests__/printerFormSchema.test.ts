import { lanConnectionSchema, printerDisplaySchema, printerDriverSchema, printerSchema } from '../printerFormSchema';
import { ConnectionType, DriverSource, PrinterDriverType, TsplRenderMode, type Printer, type PrinterDriver } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';

const escposDriver: PrinterDriver = {
  type: PrinterDriverType.escpos,
  source: DriverSource.auto,
  contentTypes: [PrintType.Receipt],
  config: { type: PrinterDriverType.escpos },
};
const tsplDriver: PrinterDriver = {
  type: PrinterDriverType.tspl,
  source: DriverSource.auto,
  contentTypes: [PrintType.Label],
  config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap },
};

const basePrinter: Printer = {
  id: 'p1',
  name: 'Máy in',
  drivers: [escposDriver],
  connectionType: ConnectionType.lan,
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('lanConnectionSchema', () => {
  it('accepts a valid IPv4 + port', () => {
    expect(lanConnectionSchema.safeParse({ lanIp: '192.168.1.10', lanPort: '9100' }).success).toBe(true);
  });

  it('rejects an invalid IPv4', () => {
    expect(lanConnectionSchema.safeParse({ lanIp: '999.1.1.1', lanPort: '9100' }).success).toBe(false);
  });
});

describe('printerDisplaySchema', () => {
  it('accepts a numeric paperSize of 58 or 80', () => {
    expect(printerDisplaySchema.safeParse({ name: 'Máy in', paperSize: 58 }).success).toBe(true);
    expect(printerDisplaySchema.safeParse({ name: 'Máy in', paperSize: 80 }).success).toBe(true);
  });

  it('rejects a string paperSize like the old "80mm"', () => {
    expect(printerDisplaySchema.safeParse({ name: 'Máy in', paperSize: '80mm' }).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(printerDisplaySchema.safeParse({ name: '', paperSize: 80 }).success).toBe(false);
  });
});

describe('printerDriverSchema', () => {
  it('accepts an escpos driver with only Receipt', () => {
    expect(printerDriverSchema.safeParse(escposDriver).success).toBe(true);
  });

  it('rejects an escpos driver assigned Label (outside its capability)', () => {
    const invalid: PrinterDriver = { ...escposDriver, contentTypes: [PrintType.Label] };
    expect(printerDriverSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects a driver whose config.type does not match driver.type', () => {
    const mismatched = { ...escposDriver, config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap } };
    expect(printerDriverSchema.safeParse(mismatched).success).toBe(false);
  });

  it('accepts a tspl driver with renderMode bitmap and no font', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: DriverSource.auto,
      contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap },
    };
    expect(printerDriverSchema.safeParse(driver).success).toBe(true);
  });

  it('accepts a tspl driver with renderMode truetype and a valid font config', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
    };
    expect(printerDriverSchema.safeParse(driver).success).toBe(true);
  });

  it('rejects a font name containing invalid characters', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: 'VIET FONT"', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
    };
    expect(printerDriverSchema.safeParse(driver).success).toBe(false);
  });

  it('rejects an empty font name', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: '', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
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

  it('rejects connectionType lan with a device set (invariant #13)', () => {
    const printer: Printer = { ...basePrinter, device: { deviceId: 'x', displayName: 'x', rawDevice: {} } };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects connectionType lan with no lan config (invariant #13)', () => {
    const printer: Printer = { ...basePrinter, lan: undefined };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects connectionType usb with a lan config set (invariant #13)', () => {
    const printer: Printer = {
      ...basePrinter,
      connectionType: ConnectionType.usb,
      device: { deviceId: '1155:22222', displayName: 'x', rawDevice: {} },
      lan: undefined,
    };
    expect(printerSchema.safeParse(printer).success).toBe(true);
    const invalid: Printer = { ...printer, lan: { ip: '1.1.1.1', port: 9100 } };
    expect(printerSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects connectionType usb with no device set (invariant #13)', () => {
    const printer: Printer = { ...basePrinter, connectionType: ConnectionType.usb, lan: undefined };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });
});

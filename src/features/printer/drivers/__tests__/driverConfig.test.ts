import { escPosRenderModeOf, mediaOf, paperSizeOf, tsplRenderModeOf, usesBitmapRenderMode, DEFAULT_TSPL_INTERNAL_FONT } from '../driverConfig';
import { DriverSource, PrintRenderMode, PrinterDriverType } from '../../models/printer/PrinterDriver';
import type { PrinterDriver } from '../../models/printer/PrinterDriver';
import { PrintPaperType } from '../../models/paper/PrintPaperConfig';
import { PrintType } from '../../models/printing/PrintType';

describe('mediaOf / paperSizeOf', () => {
  it('đọc media của driver entry', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: DriverSource.auto,
      contentTypes: [PrintType.Label],
      config: {
        type: PrinterDriverType.tspl,
        renderMode: PrintRenderMode.bitmap,
        media: { type: PrintPaperType.DieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 },
      },
    };
    expect(paperSizeOf(driver)).toBe(100);
    expect(mediaOf(driver).columns).toBe(3);
  });
});

describe('tsplRenderModeOf', () => {
  const tsplDriver = (renderMode: PrintRenderMode) =>
    ({ type: PrinterDriverType.tspl, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.tspl, renderMode } }) as never;

  it('trả renderMode đã cấu hình (không quan tâm fontInstalled)', () => {
    expect(tsplRenderModeOf(tsplDriver(PrintRenderMode.truetype))).toBe(PrintRenderMode.truetype);
    expect(tsplRenderModeOf(tsplDriver(PrintRenderMode.bitmap))).toBe(PrintRenderMode.bitmap);
  });

  it('trả null cho driver escpos', () => {
    expect(
      tsplRenderModeOf({ type: PrinterDriverType.escpos, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.escpos } } as never),
    ).toBeNull();
  });
});

describe('escPosRenderModeOf', () => {
  const escposDriver = (renderMode?: PrintRenderMode) =>
    ({ type: PrinterDriverType.escpos, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.escpos, renderMode } }) as never;

  it('trả renderMode đã cấu hình', () => {
    expect(escPosRenderModeOf(escposDriver(PrintRenderMode.bitmap))).toBe(PrintRenderMode.bitmap);
  });

  it('trả "text" khi renderMode undefined (tương thích ngược)', () => {
    expect(escPosRenderModeOf(escposDriver(undefined))).toBe(PrintRenderMode.encoder);
  });

  it('trả null cho driver tspl', () => {
    expect(
      tsplRenderModeOf({ type: PrinterDriverType.escpos, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.escpos } } as never),
    ).toBeNull();
    expect(escPosRenderModeOf({ type: PrinterDriverType.tspl, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap } } as never)).toBeNull();
  });
});

describe('usesBitmapRenderMode', () => {
  const driver = (type: PrinterDriverType, config: Record<string, unknown>) => ({ type, source: 'auto', contentTypes: [], config: { type, ...config } }) as never;

  it('true cho tspl bitmap', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.tspl, { renderMode: PrintRenderMode.bitmap }))).toBe(true);
  });

  it('false cho tspl truetype/internalfont', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.tspl, { renderMode: PrintRenderMode.truetype }))).toBe(false);
    expect(usesBitmapRenderMode(driver(PrinterDriverType.tspl, { renderMode: PrintRenderMode.internalfont }))).toBe(false);
  });

  it('true cho escpos bitmap', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.escpos, { renderMode: PrintRenderMode.bitmap }))).toBe(true);
  });

  it('false cho escpos text (kể cả renderMode undefined)', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.escpos, { renderMode: PrintRenderMode.encoder }))).toBe(false);
    expect(usesBitmapRenderMode(driver(PrinterDriverType.escpos, {}))).toBe(false);
  });
});

describe('DEFAULT_TSPL_INTERNAL_FONT', () => {
  it('là CP1258 + font bitmap "3"', () => {
    expect(DEFAULT_TSPL_INTERNAL_FONT).toEqual({ codepage: '1258', fontName: '3' });
  });
});

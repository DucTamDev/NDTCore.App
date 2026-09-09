import { escPosRenderModeOf, mediaOf, paperSizeOf, tsplRenderModeOf, usesBitmapRenderMode, DEFAULT_TSPL_INTERNAL_FONT } from '../driverConfig';
import { DriverSource, EscPosRenderMode, PrinterDriverType, TsplRenderMode } from '../../models/printer/PrinterDriver';
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
        renderMode: TsplRenderMode.bitmap,
        media: { type: PrintPaperType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 },
      },
    };
    expect(paperSizeOf(driver)).toBe(100);
    expect(mediaOf(driver).columns).toBe(3);
  });
});

describe('tsplRenderModeOf', () => {
  const tsplDriver = (renderMode: TsplRenderMode) =>
    ({ type: PrinterDriverType.tspl, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.tspl, renderMode } }) as never;

  it('trả renderMode đã cấu hình (không quan tâm fontInstalled)', () => {
    expect(tsplRenderModeOf(tsplDriver(TsplRenderMode.truetype))).toBe(TsplRenderMode.truetype);
    expect(tsplRenderModeOf(tsplDriver(TsplRenderMode.bitmap))).toBe(TsplRenderMode.bitmap);
  });

  it('trả null cho driver escpos', () => {
    expect(
      tsplRenderModeOf({ type: PrinterDriverType.escpos, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.escpos } } as never),
    ).toBeNull();
  });
});

describe('escPosRenderModeOf', () => {
  const escposDriver = (renderMode?: EscPosRenderMode) =>
    ({ type: PrinterDriverType.escpos, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.escpos, renderMode } }) as never;

  it('trả renderMode đã cấu hình', () => {
    expect(escPosRenderModeOf(escposDriver(EscPosRenderMode.bitmap))).toBe(EscPosRenderMode.bitmap);
  });

  it('trả "text" khi renderMode undefined (tương thích ngược)', () => {
    expect(escPosRenderModeOf(escposDriver(undefined))).toBe(EscPosRenderMode.text);
  });

  it('trả null cho driver tspl', () => {
    expect(
      tsplRenderModeOf({ type: PrinterDriverType.escpos, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.escpos } } as never),
    ).toBeNull();
    expect(escPosRenderModeOf({ type: PrinterDriverType.tspl, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap } } as never)).toBeNull();
  });
});

describe('usesBitmapRenderMode', () => {
  const driver = (type: PrinterDriverType, config: Record<string, unknown>) => ({ type, source: 'auto', contentTypes: [], config: { type, ...config } }) as never;

  it('true cho tspl bitmap', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.tspl, { renderMode: TsplRenderMode.bitmap }))).toBe(true);
  });

  it('false cho tspl truetype/internalfont', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.tspl, { renderMode: TsplRenderMode.truetype }))).toBe(false);
    expect(usesBitmapRenderMode(driver(PrinterDriverType.tspl, { renderMode: TsplRenderMode.internalfont }))).toBe(false);
  });

  it('true cho escpos bitmap', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.escpos, { renderMode: EscPosRenderMode.bitmap }))).toBe(true);
  });

  it('false cho escpos text (kể cả renderMode undefined)', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.escpos, { renderMode: EscPosRenderMode.text }))).toBe(false);
    expect(usesBitmapRenderMode(driver(PrinterDriverType.escpos, {}))).toBe(false);
  });
});

describe('DEFAULT_TSPL_INTERNAL_FONT', () => {
  it('là CP1258 + font bitmap "3"', () => {
    expect(DEFAULT_TSPL_INTERNAL_FONT).toEqual({ codepage: '1258', fontName: '3' });
  });
});

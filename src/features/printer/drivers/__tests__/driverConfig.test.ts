import { mediaOf, paperSizeOf, tsplRenderModeOf, DEFAULT_TSPL_INTERNAL_FONT } from '../driverConfig';
import { DriverSource, PrinterDriverType, PrintMediaType, TsplRenderMode } from '../../types/printer.types';
import type { PrinterDriver } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';

describe('mediaOf / paperSizeOf', () => {
  it('đọc media của driver entry', () => {
    const driver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: DriverSource.auto,
      contentTypes: [PrintType.Label],
      config: {
        type: PrinterDriverType.tspl,
        renderMode: TsplRenderMode.bitmap,
        media: { type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 },
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

describe('DEFAULT_TSPL_INTERNAL_FONT', () => {
  it('là CP1258 + font bitmap "3"', () => {
    expect(DEFAULT_TSPL_INTERNAL_FONT).toEqual({ codepage: '1258', fontName: '3' });
  });
});

import { DEFAULT_PAPER, usesBitmapRenderMode } from '../driverConfig';
import { DriverSource, RenderMode, PrinterDriverType } from '../../models/printer/PrinterDriver';
import type { PrinterDriver } from '../../models/printer/PrinterDriver';
import { PaperSize, PrintPaperType } from '../../models/paper/PrintPaperConfig';

describe('DEFAULT_PAPER', () => {
  it('là giấy cuộn liên tục 80mm', () => {
    expect(DEFAULT_PAPER).toEqual({ type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 });
  });
});

describe('usesBitmapRenderMode', () => {
  const driver = (type: PrinterDriverType, renderMode: RenderMode): PrinterDriver => ({
    type,
    source: DriverSource.Auto,
    config: { renderMode },
  });

  it('true cho Tspl Bitmap', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.Tspl, RenderMode.Bitmap))).toBe(true);
  });

  it('true cho EscPos Bitmap', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.EscPos, RenderMode.Bitmap))).toBe(true);
  });

  it('false cho EscPos Encoder', () => {
    expect(usesBitmapRenderMode(driver(PrinterDriverType.EscPos, RenderMode.Encoder))).toBe(false);
  });
});

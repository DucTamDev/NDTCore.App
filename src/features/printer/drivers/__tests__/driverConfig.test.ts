import { DEFAULT_PAPER, usesRasterRenderMode } from '../driverConfig';
import { LanguageSelection, RasterSource, RenderMode, PrintLanguage } from '../../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../../models/printer/PrinterLanguage';
import { PaperSize, PaperType } from '../../models/paper/PaperOptions';

describe('DEFAULT_PAPER', () => {
  it('là giấy cuộn liên tục 80mm', () => {
    expect(DEFAULT_PAPER).toEqual({ type: PaperType.Continuous, paperSize: PaperSize.Mm80 });
  });
});

describe('usesRasterRenderMode', () => {
  const driver = (type: PrintLanguage, renderMode: RenderMode): PrinterLanguage => ({
    type,
    selection: LanguageSelection.Auto,
    renderMode,
    rasterSource: RasterSource.Image,
  });

  it('true cho Tspl Bitmap', () => {
    expect(usesRasterRenderMode(driver(PrintLanguage.Tspl, RenderMode.Raster))).toBe(true);
  });

  it('true cho EscPos Bitmap', () => {
    expect(usesRasterRenderMode(driver(PrintLanguage.EscPos, RenderMode.Raster))).toBe(true);
  });

  it('false cho EscPos Encoder', () => {
    expect(usesRasterRenderMode(driver(PrintLanguage.EscPos, RenderMode.Command))).toBe(false);
  });
});

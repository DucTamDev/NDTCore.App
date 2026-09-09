import { TsplStrategyRegistry, resolveTsplStrategy } from '../TsplStrategyRegistry';
import { PrintRenderMode } from '../../../models/printer/PrinterDriver';
import { PrinterErrorCode } from '../../../errors/PrinterError';

describe('TsplStrategyRegistry', () => {
  it('resolve bitmap → strategy có mode bitmap', () => {
    expect(resolveTsplStrategy(PrintRenderMode.bitmap).mode).toBe(PrintRenderMode.bitmap);
  });
  it('resolve truetype → strategy có mode truetype', () => {
    expect(resolveTsplStrategy(PrintRenderMode.truetype).mode).toBe(PrintRenderMode.truetype);
  });
  it('resolve internalfont → strategy có mode internalfont', () => {
    expect(resolveTsplStrategy(PrintRenderMode.internalfont).mode).toBe(PrintRenderMode.internalfont);
  });
  it('registry có đúng 3 key', () => {
    expect(Object.keys(TsplStrategyRegistry).sort()).toEqual(['bitmap', 'internalfont', 'truetype']);
  });
  it('mode lạ → TSPL_RENDER_MODE_UNSUPPORTED', () => {
    try { resolveTsplStrategy('raster' as never); } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED });
    }
    expect(() => resolveTsplStrategy('raster' as never)).toThrow();
  });
});

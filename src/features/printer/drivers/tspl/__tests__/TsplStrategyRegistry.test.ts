import { TsplStrategyRegistry, resolveTsplStrategy } from '../TsplStrategyRegistry';
import { TsplRenderMode } from '../../../types/printer.types';
import { PrinterErrorCode } from '../../../types/PrinterError';

describe('TsplStrategyRegistry', () => {
  it('resolve bitmap → strategy có mode bitmap', () => {
    expect(resolveTsplStrategy(TsplRenderMode.bitmap).mode).toBe(TsplRenderMode.bitmap);
  });
  it('resolve truetype → strategy có mode truetype', () => {
    expect(resolveTsplStrategy(TsplRenderMode.truetype).mode).toBe(TsplRenderMode.truetype);
  });
  it('registry có đúng 2 key', () => {
    expect(Object.keys(TsplStrategyRegistry).sort()).toEqual(['bitmap', 'truetype']);
  });
  it('mode lạ → TSPL_RENDER_MODE_UNSUPPORTED', () => {
    try { resolveTsplStrategy('raster' as never); } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED });
    }
    expect(() => resolveTsplStrategy('raster' as never)).toThrow();
  });
});

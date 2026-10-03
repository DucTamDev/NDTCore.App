import { resolveEffectiveCutterMode } from '../cutter';
import { CutterMode, PaperType } from '../../models/paper/PaperOptions';
import type { PaperOptions } from '../../models/paper/PaperOptions';

const dieCut: PaperOptions = {
  type: PaperType.DieCut,
  paperSize: 100,
  itemWidthMm: 30,
  itemHeightMm: 20,
  columns: 3,
  horizontalGapMm: 2,
  verticalGapMm: 3,
};

const continuous = (cutterMode: CutterMode): PaperOptions => ({
  type: PaperType.Continuous,
  paperSize: 80,
  cutterMode,
});

describe('resolveEffectiveCutterMode', () => {
  it('giấy tem → không bao giờ cắt', () => {
    expect(resolveEffectiveCutterMode(dieCut)).toBe(CutterMode.None);
  });

  it('giấy cuộn → theo cấu hình', () => {
    expect(resolveEffectiveCutterMode(continuous(CutterMode.PerJob))).toBe(CutterMode.PerJob);
    expect(resolveEffectiveCutterMode(continuous(CutterMode.None))).toBe(CutterMode.None);
    expect(resolveEffectiveCutterMode(continuous(CutterMode.PerRow))).toBe(CutterMode.PerRow);
  });
});

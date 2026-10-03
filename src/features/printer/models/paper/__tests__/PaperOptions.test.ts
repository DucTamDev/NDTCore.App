import { CutterMode, resolveEffectiveCutterMode, PaperType } from '../PaperOptions';
import type { PaperOptions } from '../PaperOptions';

describe('PaperOptions domain types', () => {
  it('CutterMode có đủ 3 giá trị', () => {
    expect([CutterMode.None, CutterMode.PerJob, CutterMode.PerRow]).toEqual(['None', 'PerJob', 'PerRow']);
  });
});

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

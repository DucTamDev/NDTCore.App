import { dieCutRowOverflow, resolveEffectiveCutterMode } from '../paperUtils';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperType } from '../../models/paper/PaperType';
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

describe('dieCutRowOverflow', () => {
  it('null khi hàng vừa khổ in (3×30 + 2×2 = 94 ≤ 96)', () => {
    expect(dieCutRowOverflow(dieCut)).toBeNull();
  });

  it('báo lỗi khi hàng vượt khổ in (4×30 + 3×2 = 126 > 96)', () => {
    const message = dieCutRowOverflow({ ...dieCut, columns: 4 });
    expect(message).toContain('126');
    expect(message).toContain('96');
  });

  it('null với giấy cuộn', () => {
    expect(dieCutRowOverflow(continuous(CutterMode.PerJob))).toBeNull();
  });
});

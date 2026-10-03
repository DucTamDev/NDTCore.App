import { resolveEffectiveCutterMode } from '../cutter';
import { CutterMode, PaperType } from '../../models/paper/PaperOptions';
import type { PaperOptions } from '../../models/paper/PaperOptions';

const dieCut = (cutterMode?: CutterMode): PaperOptions => ({
  type: PaperType.DieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, cutterMode,
});
const continuous = (cutterMode?: CutterMode): PaperOptions => ({ type: PaperType.Continuous, paperSize: 80, cutterMode });

describe('resolveEffectiveCutterMode', () => {
  it('die_cut → luôn none, bất kể cutterMode', () => {
    expect(resolveEffectiveCutterMode(dieCut(undefined))).toBe(CutterMode.None);
    expect(resolveEffectiveCutterMode(dieCut(CutterMode.PerJob))).toBe(CutterMode.None);
  });
  it('continuous + cutterMode undefined → per_job (mặc định "cứ cắt")', () => {
    expect(resolveEffectiveCutterMode(continuous(undefined))).toBe(CutterMode.PerJob);
  });
  it('continuous + none → none', () => {
    expect(resolveEffectiveCutterMode(continuous(CutterMode.None))).toBe(CutterMode.None);
  });
  it('continuous + per_row → per_row', () => {
    expect(resolveEffectiveCutterMode(continuous(CutterMode.PerRow))).toBe(CutterMode.PerRow);
  });
});

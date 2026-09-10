import { resolveEffectiveCutterMode } from '../cutter';
import { CutterMode, PrintPaperType } from '../../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';

const dieCut = (cutterMode?: CutterMode): PrintPaperConfig => ({
  type: PrintPaperType.DieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, cutterMode,
});
const continuous = (cutterMode?: CutterMode): PrintPaperConfig => ({ type: PrintPaperType.Continuous, paperSize: 80, cutterMode });

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

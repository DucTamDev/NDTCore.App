import { resolveEffectiveCutterMode } from '../cutter';
import { CutterMode, PrintMediaType } from '../../../types/printer.types';
import type { PrintMedia } from '../../../types/printer.types';

const dieCut = (cutterMode?: CutterMode): PrintMedia => ({
  type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, cutterMode,
});
const continuous = (cutterMode?: CutterMode): PrintMedia => ({ type: PrintMediaType.continuous, paperSize: 80, cutterMode });

describe('resolveEffectiveCutterMode', () => {
  it('die_cut → luôn none, bất kể cutterMode', () => {
    expect(resolveEffectiveCutterMode(dieCut(undefined))).toBe(CutterMode.none);
    expect(resolveEffectiveCutterMode(dieCut(CutterMode.perJob))).toBe(CutterMode.none);
  });
  it('continuous + cutterMode undefined → per_job (mặc định "cứ cắt")', () => {
    expect(resolveEffectiveCutterMode(continuous(undefined))).toBe(CutterMode.perJob);
  });
  it('continuous + none → none', () => {
    expect(resolveEffectiveCutterMode(continuous(CutterMode.none))).toBe(CutterMode.none);
  });
  it('continuous + per_row → per_row', () => {
    expect(resolveEffectiveCutterMode(continuous(CutterMode.perRow))).toBe(CutterMode.perRow);
  });
});

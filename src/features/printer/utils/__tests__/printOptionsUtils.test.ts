import { copiesOf, cutterModeOf, feedDotsOf } from '../printOptionsUtils';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperType } from '../../models/paper/PaperType';
import type { PaperOptions } from '../../models/paper/PaperOptions';

const continuous: PaperOptions = { type: PaperType.Continuous, paperSize: 80, cutterMode: CutterMode.PerJob };

const dieCut: PaperOptions = {
  type: PaperType.DieCut,
  paperSize: 100,
  itemWidthMm: 30,
  itemHeightMm: 20,
  columns: 3,
  horizontalGapMm: 2,
  verticalGapMm: 3,
};

describe('copiesOf', () => {
  it('mặc định 1 bản, làm tròn xuống, không hợp lệ coi như 1', () => {
    expect(copiesOf()).toBe(1);
    expect(copiesOf({ copies: 3.7 })).toBe(3);
    expect(copiesOf({ copies: 0 })).toBe(1);
    expect(copiesOf({ copies: Number.NaN })).toBe(1);
  });
});

describe('feedDotsOf', () => {
  it('đổi mm sang dot (8 dot/mm), không có hoặc không hợp lệ thì 0', () => {
    expect(feedDotsOf()).toBe(0);
    expect(feedDotsOf({ feedMm: 5 })).toBe(40);
    expect(feedDotsOf({ feedMm: -2 })).toBe(0);
    expect(feedDotsOf({ feedMm: Number.NaN })).toBe(0);
  });
});

describe('cutterModeOf', () => {
  it('mặc định theo cách cắt của giấy', () => {
    expect(cutterModeOf(continuous)).toBe(CutterMode.PerJob);
    expect(cutterModeOf(dieCut)).toBe(CutterMode.None);
  });

  it('cut: false thì không cắt; cut: true không ép cắt giấy tem', () => {
    expect(cutterModeOf(continuous, { cut: false })).toBe(CutterMode.None);
    expect(cutterModeOf(dieCut, { cut: true })).toBe(CutterMode.None);
  });
});

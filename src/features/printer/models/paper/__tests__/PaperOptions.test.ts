import { CutterMode } from '../PaperOptions';

describe('PaperOptions domain types', () => {
  it('CutterMode có đủ 3 giá trị', () => {
    expect([CutterMode.None, CutterMode.PerJob, CutterMode.PerRow]).toEqual(['None', 'PerJob', 'PerRow']);
  });
});

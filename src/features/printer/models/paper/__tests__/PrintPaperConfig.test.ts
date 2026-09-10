import { CutterMode } from '../PrintPaperConfig';

describe('PrintPaperConfig domain types', () => {
  it('CutterMode có đủ 3 giá trị', () => {
    expect([CutterMode.None, CutterMode.PerJob, CutterMode.PerRow]).toEqual(['none', 'per_job', 'per_row']);
  });
});

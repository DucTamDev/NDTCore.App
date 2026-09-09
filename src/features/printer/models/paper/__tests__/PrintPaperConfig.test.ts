import { CutterMode } from '../PrintPaperConfig';

describe('PrintPaperConfig domain types', () => {
  it('CutterMode có đủ 3 giá trị', () => {
    expect([CutterMode.none, CutterMode.perJob, CutterMode.perRow]).toEqual(['none', 'per_job', 'per_row']);
  });
});

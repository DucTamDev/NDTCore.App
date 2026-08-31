import { PAPER_SIZE_SPECS, DOTS_PER_MM } from '../paperSize';

describe('PAPER_SIZE_SPECS', () => {
  it('có đủ 4 khổ giấy', () => {
    expect(Object.keys(PAPER_SIZE_SPECS).map(Number).sort((a, b) => a - b)).toEqual([58, 80, 100, 104]);
  });

  it('58mm: 50mm in được, 32 ký tự/dòng, ảnh 384px', () => {
    expect(PAPER_SIZE_SPECS[58]).toEqual({ printableWidthMm: 50, charsPerLine: 32, imageWidthPx: 384 });
  });

  it('80mm: 72mm in được, 48 ký tự/dòng, ảnh 576px', () => {
    expect(PAPER_SIZE_SPECS[80]).toEqual({ printableWidthMm: 72, charsPerLine: 48, imageWidthPx: 576 });
  });
});

describe('DOTS_PER_MM', () => {
  it('là 8 (203 dpi)', () => {
    expect(DOTS_PER_MM).toBe(8);
  });
});

import { lengthToDots, paperSizeToDots, strokeLengthToDots } from '..';
import { mm, pt, px } from '../../template';

describe('lengthToDots', () => {
  it.each([
    [mm(25.4), 203, 203],
    [mm(2), 203, 16],
    [mm(2), 300, 24],
    [pt(72), 300, 300],
    [px(96), 203, 203],
    [px(16), 203, 34],
  ])('%j ở %i dpi = %i dots', (length, dpi, expected) => {
    expect(lengthToDots(length, dpi)).toBe(expected);
  });

  it('nét tối thiểu 1 dot', () => {
    expect(lengthToDots(pt(0.1), 203)).toBe(0);
    expect(strokeLengthToDots(pt(0.1), 203)).toBe(1);
  });
});

describe('paperSizeToDots', () => {
  it('đổi khổ giấy mm sang dots, receipt không có chiều cao', () => {
    expect(paperSizeToDots({ widthMm: 50, heightMm: 30 }, 203)).toEqual({ widthDots: 400, heightDots: 240 });
    expect(paperSizeToDots({ widthMm: 72 }, 203)).toEqual({ widthDots: 575 });
  });
});

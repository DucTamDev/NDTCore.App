import { CpclFontMetrics } from '..';

describe('CpclFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng font 2', () => {
    expect(CpclFontMetrics.fontSizeToNative(undefined)).toEqual({ font: '2', magnification: 1 });
  });

  it.each([
    [9, '0'],
    [12, '2'],
    [24, '5'],
    [27, '6'],
    [47, '4'],
    [48, '1'],
    [200, '1'],
  ])('%i dots → font %s ở cỡ gốc', (fontSizeDots, font) => {
    expect(CpclFontMetrics.fontSizeToNative(fontSizeDots)).toEqual({ font, magnification: 1 });
  });

  it('round-trip: chiều cao đọc ngược bằng chiều cao font đã chọn', () => {
    for (const fontSizeDots of [9, 12, 24, 27, 47, 48]) {
      const native = CpclFontMetrics.fontSizeToNative(fontSizeDots);

      expect(CpclFontMetrics.nativeToFontSize(native.font, 0)).toBe(fontSizeDots);
    }
  });

  it('đọc ngược: size 0 là cỡ gốc, size lớn hơn coi như hệ số nhân', () => {
    expect(CpclFontMetrics.nativeToFontSize('5', 0)).toBe(24);
    expect(CpclFontMetrics.nativeToFontSize('5', 2)).toBe(48);
    expect(CpclFontMetrics.nativeToFontSize('9', 0)).toBe(12);
  });
});

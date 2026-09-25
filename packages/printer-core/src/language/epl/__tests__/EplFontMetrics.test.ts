import { EplFontMetrics } from '..';

describe('EplFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng font 2 ở hệ số 1', () => {
    expect(EplFontMetrics.fontSizeToNative(undefined)).toEqual({ font: '2', magnification: 1 });
  });

  it.each([
    [12, { font: '1', magnification: 1 }],
    [16, { font: '2', magnification: 1 }],
    [25, { font: '4', magnification: 1 }],
    [40, { font: '3', magnification: 2 }],
    [48, { font: '4', magnification: 2 }],
  ])('%i dots → %j', (fontSizeDots, expected) => {
    expect(EplFontMetrics.fontSizeToNative(fontSizeDots)).toEqual(expected);
  });

  it('không tự chọn font 5 (chỉ có chữ hoa)', () => {
    expect(EplFontMetrics.fontSizeToNative(48).font).not.toBe('5');
  });

  it('không vượt hệ số nhân 6', () => {
    expect(EplFontMetrics.fontSizeToNative(10000)).toEqual({ font: '4', magnification: 6 });
  });

  it('round-trip: chiều cao đọc ngược bằng chiều cao font đã chọn', () => {
    for (const fontSizeDots of [12, 16, 20, 24, 32, 48, 72]) {
      const native = EplFontMetrics.fontSizeToNative(fontSizeDots);

      expect(EplFontMetrics.nativeToFontSize(native.font, native.magnification)).toBe(fontSizeDots);
    }
  });

  it('đọc ngược font 5 và font lạ', () => {
    expect(EplFontMetrics.nativeToFontSize('5', 1)).toBe(48);
    expect(EplFontMetrics.nativeToFontSize('9', 2)).toBe(32);
  });
});

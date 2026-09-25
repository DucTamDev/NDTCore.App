import { TsplFontMetrics } from '..';

describe('TsplFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng font 2 ở hệ số 1', () => {
    expect(TsplFontMetrics.fontSizeToNative(undefined)).toEqual({ font: '2', magnification: 1 });
  });

  it.each([
    [12, { font: '1', magnification: 1 }],
    [20, { font: '2', magnification: 1 }],
    [25, { font: '3', magnification: 1 }],
    [48, { font: '5', magnification: 1 }],
    [96, { font: '5', magnification: 2 }],
    [100, { font: '2', magnification: 5 }],
  ])('%i dots → %j', (fontSizeDots, expected) => {
    expect(TsplFontMetrics.fontSizeToNative(fontSizeDots)).toEqual(expected);
  });

  it('không tự chọn font OCR 6-8', () => {
    for (const fontSizeDots of [19, 25, 27]) {
      expect(['6', '7', '8']).not.toContain(TsplFontMetrics.fontSizeToNative(fontSizeDots).font);
    }
  });

  it('không vượt hệ số nhân 10', () => {
    expect(TsplFontMetrics.fontSizeToNative(10000)).toEqual({ font: '5', magnification: 10 });
  });

  it('round-trip: chiều cao đọc ngược bằng chiều cao font đã chọn', () => {
    for (const fontSizeDots of [12, 20, 24, 32, 40, 64, 96]) {
      const native = TsplFontMetrics.fontSizeToNative(fontSizeDots);

      expect(TsplFontMetrics.nativeToFontSize(native.font, native.magnification)).toBe(fontSizeDots);
    }
  });

  it('đọc ngược font lạ theo font mặc định', () => {
    expect(TsplFontMetrics.nativeToFontSize('0', 2)).toBe(40);
    expect(TsplFontMetrics.characterSize('0')).toEqual({ width: 12, height: 20 });
  });
});

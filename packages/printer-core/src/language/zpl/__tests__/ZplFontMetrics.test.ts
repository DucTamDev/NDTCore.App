import { ZplFontMetrics } from '..';

describe('ZplFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng font 0 cao 30 dots', () => {
    expect(ZplFontMetrics.fontSizeToNative(undefined)).toEqual({ font: '0', heightDots: 30, widthDots: 30 });
  });

  it('cỡ chữ đi thẳng thành chiều cao/rộng dots, làm tròn', () => {
    expect(ZplFontMetrics.fontSizeToNative(25)).toEqual({ font: '0', heightDots: 25, widthDots: 25 });
    expect(ZplFontMetrics.fontSizeToNative(18.75)).toEqual({ font: '0', heightDots: 19, widthDots: 19 });
  });

  it('không cho chiều cao 0', () => {
    expect(ZplFontMetrics.fontSizeToNative(0.2).heightDots).toBe(1);
  });

  it('round-trip: chiều cao đọc ngược bằng cỡ chữ nguyên ban đầu', () => {
    for (const fontSizeDots of [10, 24, 30, 60]) {
      expect(ZplFontMetrics.nativeToFontSize(ZplFontMetrics.fontSizeToNative(fontSizeDots).heightDots)).toBe(
        fontSizeDots,
      );
    }
  });
});

import { SbplFontMetrics } from '..';

describe('SbplFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng hệ số 1', () => {
    expect(SbplFontMetrics.fontSizeToMagnification(undefined)).toBe(1);
  });

  it('làm tròn theo bậc 12 dots, kẹp trong 1..12', () => {
    expect(SbplFontMetrics.fontSizeToMagnification(1)).toBe(1);
    expect(SbplFontMetrics.fontSizeToMagnification(25)).toBe(2);
    expect(SbplFontMetrics.fontSizeToMagnification(10000)).toBe(12);
  });

  it('round-trip: chiều cao đọc ngược bằng cỡ chữ là bội số 12 dots', () => {
    for (const fontSizeDots of [12, 24, 36, 48]) {
      const magnification = SbplFontMetrics.fontSizeToMagnification(fontSizeDots);

      expect(SbplFontMetrics.magnificationToFontSize(magnification)).toBe(fontSizeDots);
    }
  });
});

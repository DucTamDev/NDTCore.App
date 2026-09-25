import { DplFontMetrics } from '..';

describe('DplFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng hệ số 1', () => {
    expect(DplFontMetrics.fontSizeToMagnification(undefined)).toBe(1);
  });

  it('làm tròn theo bậc 12 dots, kẹp trong 1..9', () => {
    expect(DplFontMetrics.fontSizeToMagnification(1)).toBe(1);
    expect(DplFontMetrics.fontSizeToMagnification(25)).toBe(2);
    expect(DplFontMetrics.fontSizeToMagnification(10000)).toBe(9);
  });

  it('round-trip: chiều cao đọc ngược bằng cỡ chữ là bội số 12 dots', () => {
    for (const fontSizeDots of [12, 24, 36, 48]) {
      const magnification = DplFontMetrics.fontSizeToMagnification(fontSizeDots);

      expect(DplFontMetrics.magnificationToFontSize(magnification)).toBe(fontSizeDots);
    }
  });
});

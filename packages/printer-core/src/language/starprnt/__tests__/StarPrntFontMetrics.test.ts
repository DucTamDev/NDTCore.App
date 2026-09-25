import { StarPrntFontMetrics } from '..';

describe('StarPrntFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng hệ số 1', () => {
    expect(StarPrntFontMetrics.fontSizeToMagnification(undefined)).toBe(1);
  });

  it('làm tròn theo bậc 24 dots, kẹp trong 1..6', () => {
    expect(StarPrntFontMetrics.fontSizeToMagnification(1)).toBe(1);
    expect(StarPrntFontMetrics.fontSizeToMagnification(80)).toBe(3);
    expect(StarPrntFontMetrics.fontSizeToMagnification(10000)).toBe(6);
  });

  it('round-trip: chiều cao đọc ngược bằng cỡ chữ là bội số 24 dots', () => {
    for (const fontSizeDots of [24, 48, 72, 144]) {
      const magnification = StarPrntFontMetrics.fontSizeToMagnification(fontSizeDots);

      expect(StarPrntFontMetrics.magnificationToFontSize(magnification)).toBe(fontSizeDots);
    }
  });
});

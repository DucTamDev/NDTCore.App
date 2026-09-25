import { EscPosFontMetrics } from '..';

describe('EscPosFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng hệ số 1', () => {
    expect(EscPosFontMetrics.fontSizeToMagnification(undefined)).toBe(1);
  });

  it('làm tròn theo bậc 24 dots của font A, kẹp trong 1..8', () => {
    expect(EscPosFontMetrics.fontSizeToMagnification(1)).toBe(1);
    expect(EscPosFontMetrics.fontSizeToMagnification(40)).toBe(2);
    expect(EscPosFontMetrics.fontSizeToMagnification(10000)).toBe(8);
  });

  it('round-trip: chiều cao đọc ngược bằng cỡ chữ là bội số 24 dots', () => {
    for (const fontSizeDots of [24, 48, 72, 192]) {
      const magnification = EscPosFontMetrics.fontSizeToMagnification(fontSizeDots);

      expect(EscPosFontMetrics.magnificationToFontSize(magnification)).toBe(fontSizeDots);
    }
  });
});

import { IplFontMetrics } from '..';

describe('IplFontMetrics', () => {
  it('không khai báo cỡ chữ thì dùng 12 dots', () => {
    expect(IplFontMetrics.fontSizeToNative(undefined)).toEqual({ heightDots: 12, widthDots: 12 });
  });

  it('cỡ chữ đi thẳng thành clause h/w dots, làm tròn, tối thiểu 1', () => {
    expect(IplFontMetrics.fontSizeToNative(24.6)).toEqual({ heightDots: 25, widthDots: 25 });
    expect(IplFontMetrics.fontSizeToNative(0.1)).toEqual({ heightDots: 1, widthDots: 1 });
  });

  it('round-trip: chiều cao đọc ngược bằng cỡ chữ nguyên ban đầu', () => {
    expect(IplFontMetrics.nativeToFontSize(IplFontMetrics.fontSizeToNative(30).heightDots)).toBe(30);
  });
});

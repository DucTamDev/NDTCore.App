import { insets, mm, pt, px } from '..';

describe('mm / pt / px', () => {
  it('giữ nguyên giá trị và đơn vị như người viết khai báo', () => {
    expect(mm(2.5)).toEqual({ value: 2.5, unit: 'mm' });
    expect(pt(9)).toEqual({ value: 9, unit: 'pt' });
    expect(px(16)).toEqual({ value: 16, unit: 'px' });
  });
});

describe('insets', () => {
  it('theo quy ước CSS 1-4 tham số', () => {
    expect(insets(mm(1))).toEqual({ top: mm(1), right: mm(1), bottom: mm(1), left: mm(1) });
    expect(insets(mm(1), mm(2))).toEqual({ top: mm(1), right: mm(2), bottom: mm(1), left: mm(2) });
    expect(insets(mm(1), mm(2), mm(3))).toEqual({ top: mm(1), right: mm(2), bottom: mm(3), left: mm(2) });
    expect(insets(mm(1), mm(2), mm(3), mm(4))).toEqual({ top: mm(1), right: mm(2), bottom: mm(3), left: mm(4) });
  });
});

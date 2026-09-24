import { auto, fill, fixed, mm } from '..';

describe('fixed / fill / auto', () => {
  it('tạo đúng dạng Dimension', () => {
    expect(fixed(mm(10))).toEqual({ type: 'fixed', value: mm(10) });
    expect(fill()).toEqual({ type: 'fill' });
    expect(auto()).toEqual({ type: 'auto' });
  });
});

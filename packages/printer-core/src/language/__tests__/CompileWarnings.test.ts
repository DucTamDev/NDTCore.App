import { CompileWarnings } from '../CompileWarnings';

describe('CompileWarnings', () => {
  it('giữ cảnh báo theo thứ tự thêm vào', () => {
    const warnings = new CompileWarnings('ZPL');
    warnings.add('A');
    warnings.add('B');

    expect(warnings.toArray()).toEqual(['A', 'B']);
  });

  it('cảnh báo trùng nội dung chỉ giữ 1', () => {
    const warnings = new CompileWarnings('EPL');
    warnings.unsupportedElement('circle');
    warnings.unsupportedElement('circle');
    warnings.unsupportedElement('ellipse');

    expect(warnings.toArray()).toEqual([
      'Element "circle" bị bỏ qua — EPL không có lệnh tương ứng.',
      'Element "ellipse" bị bỏ qua — EPL không có lệnh tương ứng.',
    ]);
  });

  it('chưa thêm gì thì rỗng', () => {
    expect(new CompileWarnings('TSPL').toArray()).toEqual([]);
  });
});

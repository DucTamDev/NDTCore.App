import { gt, insets, mm, px, text } from '..';
import { TemplateNodeIdGenerator, type BuildContext } from '../BuildContext';

function newContext(): BuildContext {
  return { idGenerator: new TemplateNodeIdGenerator() };
}

describe('text', () => {
  it('chuỗi thành 1 segment chữ, style gộp box + chữ', () => {
    const node = text('Xin chào')
      .id('greeting')
      .fontSize(px(16))
      .bold()
      .align('center')
      .lineHeight(1.3)
      .padding(insets(mm(1)))
      .build(newContext());

    expect(node).toEqual({
      type: 'text',
      id: 'greeting',
      content: [{ text: 'Xin chào' }],
      style: { padding: insets(mm(1)), fontSize: px(16), fontWeight: 'bold', textAlign: 'center', lineHeight: 1.3 },
    });
  });

  it('không có style thì không có field style, id tự sinh', () => {
    expect(text([{ var: 'orderCode' }]).build(newContext())).toEqual({
      type: 'text',
      id: 'text-1',
      content: [{ var: 'orderCode' }],
    });
  });

  it('visibleWhen gắn điều kiện vào node', () => {
    const node = text('Giảm giá').visibleWhen(gt('discount', 0)).build(newContext());

    expect(node.visibleWhen).toEqual({ op: 'gt', var: 'discount', value: 0 });
  });
});

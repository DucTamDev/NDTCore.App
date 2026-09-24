import { column, mm, row, text } from '..';
import { TemplateNodeIdGenerator, type BuildContext } from '../BuildContext';

function newContext(): BuildContext {
  return { idGenerator: new TemplateNodeIdGenerator() };
}

describe('column / row', () => {
  it('hướng, gap, căn chỉnh, node con; id tự sinh theo thứ tự build', () => {
    const node = row()
      .gap(mm(1))
      .justifyContent('space-between')
      .alignItems('center')
      .children(text('A'), text('B'))
      .build(newContext());

    expect(node).toEqual({
      type: 'container',
      id: 'container-1',
      style: { direction: 'row', gap: mm(1), justifyContent: 'space-between', alignItems: 'center' },
      children: [
        { type: 'text', id: 'text-2', content: [{ text: 'A' }] },
        { type: 'text', id: 'text-3', content: [{ text: 'B' }] },
      ],
    });
  });

  it('column mặc định chỉ có direction', () => {
    expect(column().build(newContext()).style).toEqual({ direction: 'column' });
  });
});

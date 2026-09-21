import { column, row } from '../ContainerBuilder';
import { text } from '../TextBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('ContainerBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('column() builds a container with direction "column"', () => {
    const node = column().build(context);
    expect(node).toMatchObject({ type: 'container', style: { direction: 'column' }, children: [] });
  });

  it('row() builds a container with direction "row"', () => {
    const node = row().build(context);
    expect(node.style?.direction).toBe('row');
  });

  it('gap/justifyContent/alignItems merge into style', () => {
    const node = column().gap(4).justifyContent('space-between').alignItems('center').build(context);
    expect(node.style).toEqual({ direction: 'column', gap: 4, justifyContent: 'space-between', alignItems: 'center' });
  });

  it('children() builds nested nodes recursively', () => {
    const node = row().children(text.literal('A'), text.literal('B')).build(context);
    expect(node.children).toHaveLength(2);
    expect(node.children[0]).toMatchObject({ type: 'text', text: 'A' });
  });
});

import { text } from '../TextBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('TextBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('text.literal(value) sets `text`, not `binding`', () => {
    const node = text.literal('MY SHOP').build(context);
    expect(node.text).toBe('MY SHOP');
    expect(node.binding).toBeUndefined();
  });

  it('text.binding(path) sets `binding`, not `text`', () => {
    const node = text.binding('product.name').build(context);
    expect(node.binding).toBe('product.name');
    expect(node.text).toBeUndefined();
  });

  it('fontSize/bold/align/lineHeight merge into style', () => {
    const node = text.literal('X').fontSize(24).bold().align('center').lineHeight(28).build(context);
    expect(node.style).toEqual({ fontSize: 24, fontWeight: 'bold', textAlign: 'center', lineHeight: 28 });
  });

  it('width()/margin() from NodeBuilder also apply to text', () => {
    const node = text.literal('X').width({ type: 'fixed', value: 100 }).build(context);
    expect(node.style?.width).toEqual({ type: 'fixed', value: 100 });
  });
});

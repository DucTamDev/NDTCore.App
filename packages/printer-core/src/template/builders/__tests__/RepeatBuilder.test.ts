import { repeat } from '../RepeatBuilder';
import { text } from '../TextBuilder';
import { column } from '../ContainerBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('RepeatBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('builds a RepeatNode with the given binding and template', () => {
    const node = repeat('toppings').template(text.binding('name')).build(context);
    expect(node).toMatchObject({ type: 'repeat', binding: 'toppings', template: { type: 'text', binding: 'name' } });
  });

  it('maxItemsPerPage(value) sets maxItemsPerPage', () => {
    const node = repeat('toppings').template(text.binding('name')).maxItemsPerPage(5).build(context);
    expect(node.maxItemsPerPage).toBe(5);
  });

  it('omits maxItemsPerPage when not set', () => {
    const node = repeat('toppings').template(text.binding('name')).build(context);
    expect(node.maxItemsPerPage).toBeUndefined();
  });

  it('throws when .template(...) was never called', () => {
    expect(() => repeat('toppings').build(context)).toThrow(/requires a \.template/);
  });

  it('has no width()/margin() methods (no style)', () => {
    const builder = repeat('toppings');
    // @ts-expect-error RepeatBuilder does not extend NodeBuilder's style methods
    builder.width;
  });

  it('nests directly inside column().children(...) with no cast', () => {
    const node = column()
      .children(
        text.literal('Toppings:'),
        repeat('toppings').template(text.binding('name')),
      )
      .build(context);
    expect(node.children).toHaveLength(2);
    expect(node.children[1]).toMatchObject({ type: 'repeat', binding: 'toppings' });
  });

  it('throws when maxItemsPerPage is 0 or negative', () => {
    expect(() => repeat('toppings').maxItemsPerPage(0)).toThrow(/positive integer/);
    expect(() => repeat('toppings').maxItemsPerPage(-1)).toThrow(/positive integer/);
  });
});

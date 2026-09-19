import type { TemplateNode } from '../TemplateNode';
import type { ContainerNode } from '../ContainerNode';
import type { TextNode } from '../TextNode';
import type { RepeatNode } from '../RepeatNode';

describe('TemplateNode', () => {
  it('narrows on `type` across all 7 variants', () => {
    const nodes: TemplateNode[] = [
      { type: 'container', id: 'c1', children: [] },
      { type: 'text', id: 't1', text: 'hello' },
      { type: 'line', id: 'l1' },
      { type: 'barcode', id: 'b1', content: 'ABC', symbology: 'code128' },
      { type: 'qrcode', id: 'q1', content: 'ABC' },
      { type: 'image', id: 'i1' },
      { type: 'repeat', id: 'r1', binding: 'items', template: { type: 'text', id: 't2', binding: 'name' } },
    ];
    for (const node of nodes) {
      if (node.type === 'text') expect(typeof node.id).toBe('string');
    }
    expect(nodes).toHaveLength(7);
  });

  it('TextNode allows text OR binding (both optional at the type level)', () => {
    const literal: TextNode = { type: 'text', id: 't1', text: 'MY SHOP' };
    const bound: TextNode = { type: 'text', id: 't2', binding: 'product.name' };
    expect(literal.text).toBe('MY SHOP');
    expect(bound.binding).toBe('product.name');
  });

  it('ContainerNode nests children recursively', () => {
    const tree: ContainerNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column', gap: 4 },
      children: [
        { type: 'text', id: 't1', text: 'A' },
        { type: 'container', id: 'row1', style: { direction: 'row' }, children: [{ type: 'text', id: 't2', text: 'B' }] },
      ],
    };
    expect(tree.children).toHaveLength(2);
  });

  it('RepeatNode has no style field', () => {
    const node: RepeatNode = {
      type: 'repeat',
      id: 'r1',
      binding: 'toppings',
      template: { type: 'text', id: 't1', binding: 'name' },
      maxItemsPerPage: 5,
    };
    expect(node.maxItemsPerPage).toBe(5);
    // @ts-expect-error RepeatNode has no `style`
    node.style;
  });
});

import { createDocumentResolver } from '../DocumentResolver';
import { PrintTemplateType } from '../../template/PrintTemplateType';
import type { LabelTemplate } from '../../template/PrintTemplate';
import type { PrintData } from '../PrintData';

const resolver = createDocumentResolver();

function label(root: LabelTemplate['root']): LabelTemplate {
  return { id: 't1', version: 1, type: PrintTemplateType.Label, config: { widthDots: 400, heightDots: 240, dpi: 203 }, root };
}

describe('DocumentResolver', () => {
  it('resolves a literal TextNode to its literal value', () => {
    const pages = resolver.resolve(label({ type: 'text', id: 't1', text: 'MY SHOP' }), {});
    expect(pages).toEqual([{ status: 'ok', pageIndex: 0, node: { type: 'text', id: 't1', value: 'MY SHOP' } }]);
  });

  it('resolves a bound TextNode via a dotted path', () => {
    const data: PrintData = { product: { name: 'Milk Tea' } };
    const pages = resolver.resolve(label({ type: 'text', id: 't1', binding: 'product.name' }), data);
    expect(pages[0]).toEqual({ status: 'ok', pageIndex: 0, node: { type: 'text', id: 't1', value: 'Milk Tea' } });
  });

  it('drops a node whose visibleWhen "exists" condition is false', () => {
    const tree = label({
      type: 'container', id: 'root', children: [
        { type: 'text', id: 't1', text: 'always' },
        { type: 'text', id: 't2', text: 'conditional', visibleWhen: { type: 'exists', binding: 'discount' } },
      ],
    });
    const pages = resolver.resolve(tree, {});
    const root = pages[0].status === 'ok' ? pages[0].node : null;
    expect(root?.type).toBe('container');
    if (root?.type === 'container') expect(root.children).toHaveLength(1);
  });

  it('keeps a node whose visibleWhen "equals" condition matches', () => {
    const tree = label({
      type: 'text', id: 't1', text: 'paid', visibleWhen: { type: 'equals', binding: 'status', value: 'paid' },
    });
    const pages = resolver.resolve(tree, { status: 'paid' });
    expect(pages[0]).toMatchObject({ status: 'ok' });
  });

  it('expands a RepeatNode into a ResolvedContainer with one child per item', () => {
    const tree = label({
      type: 'repeat', id: 'r1', binding: 'toppings',
      template: { type: 'text', id: 'item', binding: 'name' },
    });
    const data: PrintData = { toppings: [{ name: 'Pearl' }, { name: 'Cheese' }] };
    const pages = resolver.resolve(tree, data);
    const node = pages[0].status === 'ok' ? pages[0].node : null;
    expect(node?.type).toBe('container');
    if (node?.type === 'container') {
      expect(node.children).toEqual([
        { type: 'text', id: 'item', value: 'Pearl' },
        { type: 'text', id: 'item', value: 'Cheese' },
      ]);
    }
  });

  it('resolves an item-scoped binding with fallback to the outer scope', () => {
    const tree = label({
      type: 'repeat', id: 'r1', binding: 'items',
      template: {
        type: 'container', id: 'row', children: [
          { type: 'text', id: 'name', binding: 'name' },
          { type: 'text', id: 'store', binding: 'storeName' },
        ],
      },
    });
    const data: PrintData = { storeName: 'My Shop', items: [{ name: 'Tea' }] };
    const pages = resolver.resolve(tree, data);
    const node = pages[0].status === 'ok' ? pages[0].node : null;
    expect(node?.type).toBe('container');
    if (node?.type === 'container') {
      const row = node.children[0];
      expect(row.type).toBe('container');
      if (row.type === 'container') {
        expect(row.children).toEqual([
          { type: 'text', id: 'name', value: 'Tea' },
          { type: 'text', id: 'store', value: 'My Shop' },
        ]);
      }
    }
  });

  it('returns a page-scoped error when a binding path is missing', () => {
    const pages = resolver.resolve(label({ type: 'text', id: 't1', binding: 'product.name' }), {});
    expect(pages).toEqual([{ status: 'error', pageIndex: 0, nodeId: 't1', message: expect.stringContaining('product.name') }]);
  });

  it('returns a page-scoped error when RepeatNode.binding is not an array', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', template: { type: 'text', id: 'x', binding: 'name' } });
    const pages = resolver.resolve(tree, { toppings: 'not-an-array' });
    expect(pages[0]).toMatchObject({ status: 'error', nodeId: 'r1' });
  });

  it('errors when a TextNode has neither text nor binding', () => {
    const pages = resolver.resolve(label({ type: 'text', id: 't1' }), {});
    expect(pages[0]).toMatchObject({ status: 'error', nodeId: 't1' });
  });

  it('errors on a binding that names an inherited Object.prototype member instead of resolving it', () => {
    const pages = resolver.resolve(label({ type: 'text', id: 't1', binding: 'toString' }), {});
    expect(pages[0]).toMatchObject({ status: 'error', nodeId: 't1' });
  });

  it('returns a page-scoped error when an ImageNode binding value is not a valid Bitmap', () => {
    const tree = label({ type: 'image', id: 'img1', binding: 'logo' });
    const pages = resolver.resolve(tree, { logo: 'not-a-bitmap' });
    expect(pages[0]).toMatchObject({ status: 'error', nodeId: 'img1' });
  });
});

import { createDocumentResolver } from '../DocumentResolver';
import { PrintTemplateType } from '../../template/PrintTemplateType';
import type { LabelTemplate } from '../../template/PrintTemplate';
import type { PrintData } from '../PrintData';

const resolver = createDocumentResolver();

function label(root: LabelTemplate['root']): LabelTemplate {
  return { id: 't1', version: 1, type: PrintTemplateType.Label, config: { widthDots: 400, heightDots: 240, dpi: 203 }, root };
}

describe('DocumentResolver pagination', () => {
  it('produces 1 page when no RepeatNode has maxItemsPerPage', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', template: { type: 'text', id: 'x', binding: 'name' } });
    const data: PrintData = { toppings: Array.from({ length: 12 }, (_, i) => ({ name: `Topping ${i}` })) };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(1);
  });

  it('splits into ceil(count / maxItemsPerPage) pages', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', maxItemsPerPage: 5, template: { type: 'text', id: 'x', binding: 'name' } });
    const data: PrintData = { toppings: Array.from({ length: 12 }, (_, i) => ({ name: `Topping ${i}` })) };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(3);
    for (const [i, page] of pages.entries()) expect(page).toMatchObject({ status: 'ok', pageIndex: i });
  });

  it('slices items correctly per page, with an empty tail slice on the last page', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', maxItemsPerPage: 5, template: { type: 'text', id: 'x', binding: 'name' } });
    const data: PrintData = { toppings: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}` })) };
    const pages = resolver.resolve(tree, data);
    const values = (page: (typeof pages)[number]) => (page.status === 'ok' && page.node.type === 'container' ? page.node.children.map((c) => (c.type === 'text' ? c.value : '')) : []);
    expect(values(pages[0])).toEqual(['T0', 'T1', 'T2', 'T3', 'T4']);
    expect(values(pages[1])).toEqual(['T5', 'T6', 'T7', 'T8', 'T9']);
    expect(values(pages[2])).toEqual(['T10', 'T11']);
  });

  it('keeps a non-paginating RepeatNode fully on every page (synchronized with a paginating one)', () => {
    const tree = label({
      type: 'container', id: 'root', children: [
        { type: 'repeat', id: 'toppings', binding: 'toppings', maxItemsPerPage: 5, template: { type: 'text', id: 'ti', binding: 'name' } },
        { type: 'repeat', id: 'allergens', binding: 'allergens', template: { type: 'text', id: 'ai', binding: 'name' } },
      ],
    });
    const data: PrintData = {
      toppings: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}` })),
      allergens: [{ name: 'Nuts' }, { name: 'Dairy' }],
    };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(3);
    for (const page of pages) {
      if (page.status !== 'ok' || page.node.type !== 'container') throw new Error('expected ok container page');
      const allergensNode = page.node.children[1];
      if (allergensNode.type !== 'container') throw new Error('expected container');
      expect(allergensNode.children).toHaveLength(2);
    }
  });

  it('contributes zero pages for a hidden RepeatNode (visibleWhen false), not phantom pages', () => {
    const tree = label({
      type: 'repeat', id: 'r1', binding: 'toppings', maxItemsPerPage: 5,
      visibleWhen: { type: 'exists', binding: 'showToppings' },
      template: { type: 'text', id: 'x', binding: 'name' },
    });
    const data: PrintData = { toppings: Array.from({ length: 12 }, (_, i) => ({ name: `Topping ${i}` })) };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(1);
  });

  it('isolates a resolve error to its own page without affecting other pages', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', maxItemsPerPage: 1, template: { type: 'text', id: 'x', binding: 'name' } });
    const data: PrintData = { toppings: [{ name: 'Pearl' }, {}, { name: 'Cheese' }] };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toMatchObject({ status: 'ok' });
    expect(pages[1]).toMatchObject({ status: 'error', pageIndex: 1 });
    expect(pages[2]).toMatchObject({ status: 'ok' });
  });
});

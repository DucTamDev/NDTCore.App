import { labelPagesOf, type LabelContent } from '../LabelContent';
import type { PrintItem, PrintTopping } from '../PrintItem';
import { DEFAULT_LABEL_TEMPLATE } from '../../../templates';

const topping = (name: string, quantity = 1): PrintTopping => ({ name, quantity, price: 8000 });

const item = (overrides: Partial<PrintItem> = {}): PrintItem => ({
  name: 'Trà sữa',
  quantity: 1,
  unitPrice: 45000,
  attributes: [],
  toppings: [],
  note: null,
  ...overrides,
});

const contentOf = (items: PrintItem[]): LabelContent => ({
  storeName: null,
  orderNumber: 'A1',
  serviceType: null,
  time: '',
  items,
});

const sevenToppings = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => topping(name));

describe('labelPagesOf', () => {
  it('mỗi phần món một ly, đánh số ly trên cả đơn', () => {
    const pages = labelPagesOf(contentOf([item({ quantity: 2 }), item({ name: 'Cà phê' })]), DEFAULT_LABEL_TEMPLATE);
    expect(pages.map((page) => [page.item.name, page.cupNumber, page.cupCount])).toEqual([
      ['Trà sữa', 1, 3],
      ['Trà sữa', 2, 3],
      ['Cà phê', 3, 3],
    ]);
  });

  it('ly nhiều topping hơn mức tối đa thì tách tem, các tem của một ly đứng liền nhau', () => {
    const pages = labelPagesOf(contentOf([item({ quantity: 2, toppings: sevenToppings })]), DEFAULT_LABEL_TEMPLATE);
    expect(pages.map((page) => [page.cupNumber, page.partNumber, page.partCount, page.toppings.length])).toEqual([
      [1, 1, 2, 5],
      [1, 2, 2, 2],
      [2, 1, 2, 5],
      [2, 2, 2, 2],
    ]);
  });

  it('topping x2, x3 vẫn tính là một dòng', () => {
    const toppings = [topping('a', 3), topping('b', 2), topping('c'), topping('d'), topping('e')];
    expect(labelPagesOf(contentOf([item({ toppings })]), DEFAULT_LABEL_TEMPLATE)).toHaveLength(1);
  });

  it('tắt topping thì mỗi ly đúng một tem, không có dòng topping', () => {
    const options = { ...DEFAULT_LABEL_TEMPLATE, showToppings: false };
    const pages = labelPagesOf(contentOf([item({ toppings: sevenToppings })]), options);
    expect(pages).toHaveLength(1);
    expect(pages[0].toppings).toEqual([]);
  });

  it('mức tối đa nhỏ hơn 1 coi là 1', () => {
    const options = { ...DEFAULT_LABEL_TEMPLATE, maxToppingsPerLabel: 0 };
    expect(labelPagesOf(contentOf([item({ toppings: sevenToppings.slice(0, 3) })]), options)).toHaveLength(3);
  });

  it('món không topping vẫn có một tem', () => {
    expect(labelPagesOf(contentOf([item()]), DEFAULT_LABEL_TEMPLATE)[0]).toMatchObject({ partNumber: 1, partCount: 1 });
  });
});

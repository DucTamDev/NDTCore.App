import { defineCollection } from '..';
import { createTemplateDataReader } from '../TemplateDataReader';

interface TestItem {
  readonly name: string;
  readonly toppings: readonly string[];
}

const TOPPINGS = defineCollection({
  label: 'Topping',
  get: (item: TestItem) => item.toppings,
  variables: { toppingName: { label: 'Tên topping', type: 'string', get: (topping) => topping } },
});

const ITEMS = defineCollection({
  label: 'Món',
  get: (order: { readonly items: readonly TestItem[] }) => order.items,
  variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
  collections: { toppings: TOPPINGS },
});

const ORDER = { code: 'HD001', items: [{ name: 'Trà sữa', toppings: ['Trân châu'] }] };

describe('createTemplateDataReader', () => {
  const reader = createTemplateDataReader(
    { orderCode: { label: 'Mã đơn', type: 'string', get: (order: typeof ORDER) => order.code } },
    { items: ITEMS },
  );

  it('đọc biến và collection ở mọi cấp theo tên', () => {
    const firstItem = ORDER.items[0];

    expect(reader.readVariable('orderCode', ORDER)).toBe('HD001');
    expect(reader.readVariable('itemName', firstItem)).toBe('Trà sữa');
    expect(reader.readCollection('items', ORDER)).toEqual(ORDER.items);
    expect(reader.readCollection('toppings', firstItem)).toEqual(['Trân châu']);
  });

  it('throw khi đọc biến hoặc collection không tồn tại', () => {
    expect(() => reader.readVariable('missing', ORDER)).toThrow('Dữ liệu template không có biến "missing"');
    expect(() => reader.readCollection('missing', ORDER)).toThrow('Dữ liệu template không có collection "missing"');
  });

  it('throw khi tên trùng ở bất kỳ cấp nào', () => {
    const duplicated = { itemName: { label: 'Tên', type: 'string', get: () => '' } } as const;

    expect(() => createTemplateDataReader(duplicated, { items: ITEMS })).toThrow(
      'Tên "itemName" bị trùng trong dữ liệu template',
    );
  });

  it('throw khi tên bắt đầu bằng "$"', () => {
    const reserved = { $page: { label: 'Trang', type: 'number', get: () => 1 } } as const;

    expect(() => createTemplateDataReader(reserved, {})).toThrow('tiền tố "$" dành cho biến có sẵn');
  });
});

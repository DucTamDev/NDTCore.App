import { defineCatalog, defineCollection } from '..';
import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE } from '../../testing';

describe('defineCatalog', () => {
  it('đọc giá trị biến gốc và biến tính toán của collection', () => {
    const firstItem = TEST_ORDER_SAMPLE.items[0];

    expect(TEST_ORDER_CATALOG.readVariable('orderCode', TEST_ORDER_SAMPLE)).toBe('HD001');
    expect(TEST_ORDER_CATALOG.readVariable('itemTotal', firstItem)).toBe(135000);
  });

  it('đọc mảng phần tử của collection cấp 1 và collection lồng', () => {
    const firstItem = TEST_ORDER_SAMPLE.items[0];

    expect(TEST_ORDER_CATALOG.readCollection('items', TEST_ORDER_SAMPLE)).toHaveLength(2);
    expect(TEST_ORDER_CATALOG.readCollection('toppings', firstItem)).toEqual([{ name: 'Trân châu', price: 5000 }]);
  });

  it('throw khi đọc biến hoặc collection không tồn tại', () => {
    expect(() => TEST_ORDER_CATALOG.readVariable('missing', TEST_ORDER_SAMPLE)).toThrow('không có biến "missing"');
    expect(() => TEST_ORDER_CATALOG.readCollection('missing', TEST_ORDER_SAMPLE)).toThrow(
      'không có collection "missing"',
    );
  });

  it('throw khi tên biến trùng giữa biến gốc và biến của collection', () => {
    const items = defineCollection({
      label: 'Món',
      get: (order: { readonly items: readonly string[] }) => order.items,
      variables: { name: { label: 'Tên', type: 'string', get: (item) => item } },
    });

    expect(() =>
      defineCatalog({
        id: 'duplicate',
        version: 1,
        sample: { name: 'A', items: [] as readonly string[] },
        variables: { name: { label: 'Tên', type: 'string', get: (order) => order.name } },
        collections: { items },
      }),
    ).toThrow('Tên "name" bị trùng trong catalog');
  });

  it('throw khi tên collection trùng tên biến', () => {
    const items = defineCollection({
      label: 'Món',
      get: (order: { readonly items: readonly string[] }) => order.items,
      variables: {},
    });

    expect(() =>
      defineCatalog({
        id: 'duplicate',
        version: 1,
        sample: { items: [] as readonly string[] },
        variables: { items: { label: 'Món', type: 'string', get: () => '' } },
        collections: { items },
      }),
    ).toThrow('Tên "items" bị trùng trong catalog');
  });

  it('throw khi tên biến bắt đầu bằng "$"', () => {
    expect(() =>
      defineCatalog({
        id: 'reserved',
        version: 1,
        sample: {},
        variables: { $page: { label: 'Trang', type: 'number', get: () => 1 } },
      }),
    ).toThrow('tiền tố "$" dành cho biến có sẵn');
  });

  it('describe() trả metadata JSON thuần, không lộ hàm get', () => {
    const description = TEST_ORDER_CATALOG.describe();

    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
    expect(description.variables.map((variable) => variable.name)).toEqual([
      'orderCode',
      'tableName',
      'createdAt',
      'discount',
      'storeLogo',
    ]);
    expect(description.variables[1]).toEqual({ name: 'tableName', label: 'Tên bàn', type: 'string', optional: true });
    expect(description.collections[0].name).toBe('items');
    expect(description.collections[0].collections[0].name).toBe('toppings');
    expect(description.collections[0].variables[4].deprecated).toBe('Dùng itemName');
  });
});

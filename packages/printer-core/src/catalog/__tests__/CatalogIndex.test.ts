import { createCatalogIndex, isBuiltInVariableName } from '..';
import { TEST_ORDER_CATALOG } from '../../testing';

describe('createCatalogIndex', () => {
  const index = createCatalogIndex(TEST_ORDER_CATALOG.describe());

  it('ghi collection sở hữu của từng biến', () => {
    expect(index.variables.get('orderCode')?.collection).toBeNull();
    expect(index.variables.get('itemName')?.collection).toBe('items');
    expect(index.variables.get('toppingName')?.collection).toBe('toppings');
  });

  it('ghi collection cha của từng collection', () => {
    expect(index.collections.get('items')?.parent).toBeNull();
    expect(index.collections.get('toppings')?.parent).toBe('items');
  });

  it('không có tên lạ trong bảng tra', () => {
    expect(index.variables.has('missing')).toBe(false);
    expect(index.collections.has('missing')).toBe(false);
  });
});

describe('isBuiltInVariableName', () => {
  it('nhận đúng 6 biến có sẵn', () => {
    const names = ['$position', '$total', '$unit', '$unitCount', '$page', '$pageCount'];

    expect(names.every(isBuiltInVariableName)).toBe(true);
    expect(isBuiltInVariableName('$other')).toBe(false);
    expect(isBuiltInVariableName('toString')).toBe(false);
  });
});

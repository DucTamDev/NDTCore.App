import { basePriceOf, lineTotalOf, toppingTextOf, type PrintItem } from '../PrintItem';
import { FontSizePreset, scaleFontSizes } from '../FontSizePreset';

const milkTea: PrintItem = {
  name: 'Trà sữa',
  quantity: 2,
  unitPrice: 69000,
  attributes: ['Size M'],
  toppings: [
    { name: 'Trân châu', quantity: 2, price: 8000 },
    { name: 'Thạch', quantity: 1, price: 8000 },
  ],
  note: null,
};

describe('PrintItem', () => {
  it('đơn giá trước topping cộng tiền topping bằng đơn giá', () => {
    expect(basePriceOf(milkTea)).toBe(45000);
  });

  it('thành tiền là đơn giá nhân số lượng', () => {
    expect(lineTotalOf(milkTea)).toBe(138000);
  });

  it('chỉ ghi số lượng topping khi từ 2 trở lên', () => {
    expect(milkTea.toppings.map(toppingTextOf)).toEqual(['Trân châu x2', 'Thạch']);
  });
});

describe('scaleFontSizes', () => {
  it('nhân theo mức rồi làm tròn về dot nguyên', () => {
    const normal = { title: 22, body: 17 };
    expect(scaleFontSizes(normal, FontSizePreset.Small)).toEqual({ title: 19, body: 14 });
    expect(scaleFontSizes(normal, FontSizePreset.Normal)).toEqual(normal);
    expect(scaleFontSizes(normal, FontSizePreset.Large)).toEqual({ title: 26, body: 20 });
  });
});

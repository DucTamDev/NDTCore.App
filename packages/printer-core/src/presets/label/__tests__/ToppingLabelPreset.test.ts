import { ToppingLabelPreset } from '../ToppingLabelPreset';

describe('ToppingLabelPreset', () => {
  it('has the same shared 40x30mm 203dpi label config as ProductLabelPreset', () => {
    expect(ToppingLabelPreset.config).toEqual({ width: 40, height: 30, unit: 'mm', dpi: 203 });
  });

  it('builds topping name, drink name, sweetness/ice line, and note elements from full vars', () => {
    const elements = ToppingLabelPreset.build({
      toppingName: 'Trân châu đen',
      drinkName: 'Trà sữa truyền thống',
      sweetness: '50%',
      ice: 'ít',
      note: 'Thêm topping',
    });

    expect(elements).toEqual([
      { type: 'text', content: 'Trân châu đen', options: { x: 8, y: 8, bold: true, size: 2 } },
      { type: 'text', content: 'Trà sữa truyền thống', options: { x: 8, y: 40 } },
      { type: 'text', content: 'Ngọt: 50% | Đá: ít', options: { x: 8, y: 70 } },
      { type: 'text', content: 'Thêm topping', options: { x: 8, y: 100 } },
    ]);
  });

  it('joins only the sweetness/ice fields that are present', () => {
    const elements = ToppingLabelPreset.build({ toppingName: 'X', ice: 'nhiều' });
    const line = elements.find((e) => e.type === 'text' && e.content.startsWith('Đá:'));
    expect(line).toMatchObject({ content: 'Đá: nhiều' });
  });

  it('omits the sweetness/ice line entirely when neither is given', () => {
    const elements = ToppingLabelPreset.build({ toppingName: 'X' });
    expect(elements.map((e) => e.type)).toEqual(['text']);
  });
});

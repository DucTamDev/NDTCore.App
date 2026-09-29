import { describe, it, expect } from 'vitest';
import { defaultCode, defaultData } from '../defaultSample';
import { evaluateTemplate } from '../evaluateTemplate';
import { renderPreviews, type PagePreview } from '../pipeline';

/** Gộp cảnh báo của các preview đã in được, bỏ qua preview lỗi (không thuộc phạm vi test này). */
function warningsOf(previews: readonly PagePreview[]): readonly (readonly string[])[] {
  return previews.map((preview) => (preview.status === 'ok' ? preview.warnings : []));
}

describe('defaultSample', () => {
  it('code mẫu chạy được, data mẫu khớp templateData.sample và in ra mỗi ly 1 tem', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    expect(JSON.parse(defaultData)).toEqual(evaluated.templateData.sample);

    const previews = renderPreviews(evaluated.template, evaluated.templateData, JSON.parse(defaultData), 'tspl');
    expect(previews.map((preview) => preview.status)).toEqual(['ok', 'ok']);
    expect(warningsOf(previews)).toEqual([[], []]);
  });

  it('mẫu khai báo settings: style tên món và option in giá; tắt option thì tem không in giá', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    const { settings } = evaluated.template;
    expect(Object.keys(settings.styles)).toEqual(['productName']);
    const showPrice = settings.options.showPrice;
    if (showPrice?.type !== 'boolean') throw new Error('mẫu cần option boolean showPrice');

    const withoutPrice = {
      ...evaluated.template,
      settings: { ...settings, options: { ...settings.options, showPrice: { ...showPrice, value: false } } },
    };
    const [firstLabel] = renderPreviews(withoutPrice, evaluated.templateData, JSON.parse(defaultData), 'tspl');
    if (firstLabel.status !== 'ok') throw new Error(firstLabel.message);

    expect(firstLabel.svg).not.toContain('45.000đ');
  });

  it('món 9 topping tách thành 5 tem mỗi ly (2 + 2 + 2 + 2 + 1)', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    const data = JSON.parse(defaultData);
    data.products[0].toppings = Array.from({ length: 9 }, (_, index) => ({ name: `Topping ${index + 1}` }));

    const previews = renderPreviews(evaluated.template, evaluated.templateData, data, 'tspl');
    expect(previews.map((preview) => preview.status)).toEqual(Array.from({ length: 10 }, () => 'ok'));
    expect(warningsOf(previews)).toEqual(Array.from({ length: 10 }, () => []));

    const firstCupLabels = previews.slice(0, 5).map((preview) => (preview.status === 'ok' ? preview.svg : ''));
    expect(firstCupLabels.map((svg) => svg.includes('45.000đ'))).toEqual([true, false, false, false, false]);
    expect(firstCupLabels[0]).toContain('+ Topping 2');
    expect(firstCupLabels[0]).not.toContain('+ Topping 3');
    expect(firstCupLabels[1]).toContain('+ Topping 3');
    expect(firstCupLabels[1]).toContain('+ Topping 4');
    expect(firstCupLabels[4]).toContain('+ Topping 9');
    expect(firstCupLabels.map((svg) => /\(tiếp (\d)\/5\)/.exec(svg)?.[1])).toEqual(['1', '2', '3', '4', '5']);
  });
});

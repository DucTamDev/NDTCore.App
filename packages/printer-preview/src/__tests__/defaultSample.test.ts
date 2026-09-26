import { describe, it, expect } from 'vitest';
import { defaultCode, defaultData } from '../defaultSample';
import { evaluateTemplate } from '../evaluateTemplate';
import { renderPreviews } from '../pipeline';

describe('defaultSample', () => {
  it('code mẫu chạy được, data mẫu khớp catalog.sample và in ra mỗi ly 1 tem', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    expect(JSON.parse(defaultData)).toEqual(evaluated.catalog.sample);

    const previews = renderPreviews(evaluated.template, evaluated.catalog, JSON.parse(defaultData), 'tspl');
    expect(previews.map((preview) => preview.status)).toEqual(['ok', 'ok']);
  });

  it('món 9 topping tách thành 3 tem mỗi ly (4 + 4 + 1)', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    const data = JSON.parse(defaultData);
    data.products[0].toppings = Array.from({ length: 9 }, (_, index) => ({ name: `Topping ${index + 1}` }));

    const previews = renderPreviews(evaluated.template, evaluated.catalog, data, 'tspl');
    expect(previews.map((preview) => preview.status)).toEqual(Array.from({ length: 6 }, () => 'ok'));
  });
});

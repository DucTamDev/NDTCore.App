import { describe, it, expect } from 'vitest';
import { px, type TemplateNode, type TextNode } from 'printer-core';
import { defaultCode, defaultData } from '../defaultSample';
import { evaluateTemplate } from '../evaluateTemplate';
import { renderPreviews, type PagePreview } from '../pipeline';

/** Từng tem có bị cảnh báo tràn chiều cao hay không; preview lỗi tính là không. */
function overflowsLabelHeight(previews: readonly PagePreview[]): readonly boolean[] {
  return previews.map(
    (preview) => preview.status === 'ok' && preview.warnings.some((warning) => warning.includes('vượt chiều cao tem')),
  );
}

/** Cỡ chữ SVG của thẻ `<text>` chứa đúng nội dung này; không có thì 0. */
function fontSizeOf(svg: string, content: string): number {
  const escapedContent = content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`font-size="(\\d+(?:\\.\\d+)?)"[^>]*>${escapedContent}</text>`).exec(svg);
  return match === null ? 0 : Number(match[1]);
}

/** Mọi node chữ trong cây template, kể cả trong container và repeat lồng nhau. */
function collectTextNodes(node: TemplateNode): readonly TextNode[] {
  if (node.type === 'text') return [node];
  if (node.type === 'container') return node.children.flatMap(collectTextNodes);
  if (node.type === 'repeat') return collectTextNodes(node.template);
  return [];
}

describe('defaultSample', () => {
  it('code mẫu chạy được, data mẫu khớp templateData.sample và in ra mỗi ly 1 tem', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    expect(JSON.parse(defaultData)).toEqual(evaluated.templateData.sample);

    const previews = renderPreviews(evaluated.template, evaluated.templateData, JSON.parse(defaultData), 'tspl');
    expect(previews.map((preview) => preview.status)).toEqual(['ok', 'ok']);
    expect(overflowsLabelHeight(previews)).toEqual([false, false]);
  });

  it('mẫu khai báo settings: style từng dòng và option in giá; tắt option thì tem không in giá', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    const { settings } = evaluated.template;
    expect(Object.keys(settings.styles)).toEqual([
      'productName',
      'productPrice',
      'toppingName',
      'orderInfo',
      'partInfo',
    ]);
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

  it('mọi dòng chữ của mẫu đều lấy cỡ chữ từ 1 style trong settings', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    const { content, settings } = evaluated.template;
    const styleNames = collectTextNodes(content).map((node) => node.styleName);

    expect(styleNames).toEqual(['productName', 'productPrice', 'toppingName', 'orderInfo', 'partInfo']);
    expect(styleNames.every((name) => name !== undefined && name in settings.styles)).toBe(true);
  });

  it('cỡ chữ topping lấy từ style toppingName trong settings', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    const { settings } = evaluated.template;
    const toppingStyle = settings.styles.toppingName;
    if (toppingStyle === undefined) throw new Error('mẫu cần style toppingName');

    const largerTopping = {
      ...evaluated.template,
      settings: {
        ...settings,
        styles: { ...settings.styles, toppingName: { ...toppingStyle, value: { fontSize: px(24) } } },
      },
    };
    const [defaultLabel] = renderPreviews(evaluated.template, evaluated.templateData, JSON.parse(defaultData), 'tspl');
    const [largerLabel] = renderPreviews(largerTopping, evaluated.templateData, JSON.parse(defaultData), 'tspl');
    if (defaultLabel.status !== 'ok' || largerLabel.status !== 'ok') throw new Error('preview mẫu phải chạy được');

    expect(fontSizeOf(largerLabel.svg, '+ Trân châu')).toBeGreaterThan(fontSizeOf(defaultLabel.svg, '+ Trân châu'));
  });

  // Config mẫu giữ 4 topping/tem dù tem 4 topping không đủ chỗ: không tự giảm số topping hay co chữ, chỉ cảnh báo.
  it('món 9 topping tách thành 3 tem mỗi ly (4 + 4 + 1); tem đủ 4 topping bị cảnh báo tràn', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    const data = JSON.parse(defaultData);
    data.products[0].toppings = Array.from({ length: 9 }, (_, index) => ({ name: `Topping ${index + 1}` }));

    const previews = renderPreviews(evaluated.template, evaluated.templateData, data, 'tspl');
    expect(previews.map((preview) => preview.status)).toEqual(Array.from({ length: 6 }, () => 'ok'));
    expect(overflowsLabelHeight(previews)).toEqual([true, true, false, true, true, false]);

    const firstCupLabels = previews.slice(0, 3).map((preview) => (preview.status === 'ok' ? preview.svg : ''));
    expect(firstCupLabels.map((svg) => svg.includes('45.000đ'))).toEqual([true, false, false]);
    expect(firstCupLabels[0]).toContain('+ Topping 4');
    expect(firstCupLabels[0]).not.toContain('+ Topping 5');
    expect(firstCupLabels[1]).toContain('+ Topping 5');
    expect(firstCupLabels[1]).toContain('+ Topping 8');
    expect(firstCupLabels[2]).toContain('+ Topping 9');
    expect(firstCupLabels.map((svg) => /\(tiếp (\d)\/3\)/.exec(svg)?.[1])).toEqual(['1', '2', '3']);
  });
});

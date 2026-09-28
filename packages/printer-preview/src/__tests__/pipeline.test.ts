import { describe, it, expect } from 'vitest';
import { column, defineCollection, defineTemplateData, labelTemplate, receiptTemplate, text } from 'printer-core';
import { defaultLanguageFor, renderPreviews } from '../pipeline';

interface DemoData {
  readonly title: string;
  readonly items: readonly { readonly name?: string }[];
}

const items = defineCollection({
  label: 'Món',
  get: (data: DemoData) => data.items,
  variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
});

const templateData = defineTemplateData({
  id: 'demo',
  version: 1,
  sample: { title: 'Xin chào', items: [] } as DemoData,
  variables: { title: { label: 'Tiêu đề', type: 'string', get: (data) => data.title } },
  collections: { items },
});

function label() {
  return labelTemplate(templateData).id('label').name('Tem').paper({ widthMm: 50, heightMm: 30 });
}

describe('renderPreviews', () => {
  it('render 1 trang SVG cho label đơn giản', () => {
    const template = label()
      .root((scope) => column().children(text([scope.var('title')])))
      .build();
    const previews = renderPreviews(template, templateData, { title: 'Hello', items: [] }, 'tspl');

    expect(previews).toHaveLength(1);
    expect(previews[0].status).toBe('ok');
    if (previews[0].status === 'ok') expect(previews[0].svg).toContain('<svg');
  });

  it('lỗi 1 trang không ảnh hưởng trang khác', () => {
    const template = label()
      .root((scope) =>
        scope
          .repeat({ collection: 'items' }, (item) => column().children(text([item.var('itemName')])))
          .maxItemsPerPage(1),
      )
      .build();
    const data: DemoData = { title: 'x', items: [{ name: 'A' }, {}, { name: 'C' }] };
    const previews = renderPreviews(template, templateData, data, 'tspl');

    expect(previews.map((preview) => preview.status)).toEqual(['ok', 'error', 'ok']);
  });

  it('defaultLanguageFor: receipt → escpos, label → tspl', () => {
    const labelDocument = label().root(text('x')).build();
    const receipt = receiptTemplate(templateData)
      .id('receipt')
      .name('Hoá đơn')
      .paper({ widthMm: 72 })
      .root(text('x'))
      .build();

    expect(defaultLanguageFor(labelDocument)).toBe('tspl');
    expect(defaultLanguageFor(receipt)).toBe('escpos');
  });
});

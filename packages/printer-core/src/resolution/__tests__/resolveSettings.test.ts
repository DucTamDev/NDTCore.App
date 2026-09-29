import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
import type { TemplateDocument, TemplateNode, TemplateSettings } from '../../template';
import { TEST_ORDER_DATA, TEST_ORDER_SAMPLE } from '../../testing';

const NO_ASSETS: AssetProvider = { get: () => undefined };

const SETTINGS: TemplateSettings = {
    styles: {
      itemName: {
        label: 'Tên món',
        value: { fontSize: { value: 20, unit: 'px' }, fontWeight: 'bold' },
        default: { fontSize: { value: 12, unit: 'px' } },
      },
    },
    options: {
      showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
      footerText: { label: 'Dòng cuối', type: 'text', value: 'Wifi: abc', default: 'Cảm ơn quý khách' },
      priceStyle: {
        label: 'Kiểu giá',
        type: 'choice',
        choices: [
          { value: 'short', label: '45k' },
          { value: 'full', label: '45.000đ' },
        ],
        value: 'full',
        default: 'short',
      },
    },
  };

function resolveChildren(children: readonly TemplateNode[], settings: TemplateSettings = SETTINGS): ResolvedPage {
  const template: TemplateDocument = {
    schemaVersion: 1,
    metadata: { id: 'template', name: 'Template', kind: 'receipt', locale: 'vi-VN', paper: { widthMm: 72 } },
    settings,
    content: { type: 'container', id: 'root', children },
  };
  const [page] = createDocumentResolver().resolve(template, TEST_ORDER_SAMPLE, {
    templateData: TEST_ORDER_DATA,
    assets: NO_ASSETS,
  });
  return page;
}

function resolvedChildren(page: ResolvedPage): readonly ResolvedNode[] {
  if (page.status !== 'ok' || page.node.type !== 'container') throw new Error('trang lỗi');
  return page.node.children;
}

function textIds(page: ResolvedPage): readonly string[] {
  return resolvedChildren(page).map((node) => node.id);
}

function textWith(id: string, extra: Partial<Extract<TemplateNode, { type: 'text' }>>): TemplateNode {
  return { type: 'text', id, content: [{ text: id }], ...extra };
}

describe('DocumentResolver — settings', () => {
  it('text dùng style có tên lấy style chữ từ value (không phải default), giữ style hộp viết thẳng', () => {
    const side = { value: 1, unit: 'mm' as const };
    const padding = { top: side, right: side, bottom: side, left: side };
    const page = resolveChildren([textWith('name', { styleName: 'itemName', style: { padding } })]);

    expect(resolvedChildren(page)[0]).toMatchObject({
      type: 'text',
      style: { padding, fontSize: { value: 20, unit: 'px' }, fontWeight: 'bold' },
    });
  });

  it('điều kiện option boolean đánh giá theo value', () => {
    const page = resolveChildren([
      textWith('shown-when-on', { visibleWhen: { op: 'option', option: 'showPrice' } }),
      textWith('shown-when-off', { visibleWhen: { op: 'not', condition: { op: 'option', option: 'showPrice' } } }),
      textWith('equals-false', { visibleWhen: { op: 'option', option: 'showPrice', equals: false } }),
    ]);

    expect(textIds(page)).toEqual(['shown-when-off', 'equals-false']);
  });

  it('điều kiện option choice so equals với value, lồng được trong and/or', () => {
    const page = resolveChildren([
      textWith('full', { visibleWhen: { op: 'option', option: 'priceStyle', equals: 'full' } }),
      textWith('short', { visibleWhen: { op: 'option', option: 'priceStyle', equals: 'short' } }),
      textWith('full-with-code', {
        visibleWhen: {
          op: 'and',
          conditions: [
            { op: 'option', option: 'priceStyle', equals: 'full' },
            { op: 'exists', var: 'orderCode' },
          ],
        },
      }),
    ]);

    expect(textIds(page)).toEqual(['full', 'full-with-code']);
  });

  it('segment option in đúng value của option text', () => {
    const [node] = resolvedChildren(
      resolveChildren([textWith('footer', { content: [{ text: '— ' }, { option: 'footerText' }] })]),
    );

    expect(node).toMatchObject({ type: 'text', value: '— Wifi: abc' });
  });

  it('tham chiếu setting không tồn tại lúc resolve thành lỗi trang', () => {
    const page = resolveChildren([textWith('footer', { content: [{ option: 'header' }] })]);

    expect(page).toMatchObject({ status: 'error', nodeId: 'footer', message: 'settings không có option "header"' });
  });
});

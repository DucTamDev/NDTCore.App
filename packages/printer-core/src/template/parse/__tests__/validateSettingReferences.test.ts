import { validateTemplateAgainstData } from '..';
import { TEST_ORDER_DATA } from '../../../testing';
import type { TemplateDocument, TemplateNode, TemplateSettings } from '../..';

const description = TEST_ORDER_DATA.describe();

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

function documentWith(children: readonly TemplateNode[]): TemplateDocument {
  return {
    schemaVersion: 1,
    metadata: { id: 'template', name: 'Template', kind: 'receipt', locale: 'vi-VN', paper: { widthMm: 72 } },
    settings: SETTINGS,
    content: { type: 'container', id: 'root', children },
  };
}

function textWith(id: string, extra: Partial<Extract<TemplateNode, { type: 'text' }>>): TemplateNode {
  return { type: 'text', id, content: [{ text: id }], ...extra };
}

/** Node dùng đủ mọi style/option khai báo — để các test chỉ thấy lỗi của phần mình thêm vào. */
const USES_ALL: readonly TemplateNode[] = [
  textWith('name', { styleName: 'itemName' }),
  textWith('footer', { content: [{ option: 'footerText' }] }),
  textWith('price', { visibleWhen: { op: 'option', option: 'showPrice' } }),
  textWith('style', { visibleWhen: { op: 'option', option: 'priceStyle', equals: 'short' } }),
];

describe('validateTemplateAgainstData — tham chiếu settings', () => {
  it('không lỗi, không cảnh báo khi mọi tham chiếu hợp lệ và mọi setting đều được dùng', () => {
    expect(validateTemplateAgainstData(documentWith(USES_ALL), description)).toEqual({ errors: [], warnings: [] });
  });

  it('báo lỗi style hoặc option không có trong settings', () => {
    const result = validateTemplateAgainstData(
      documentWith([
        ...USES_ALL,
        textWith('bad-style', { styleName: 'total' }),
        textWith('bad-segment', { content: [{ option: 'header' }] }),
        textWith('bad-condition', { visibleWhen: { op: 'option', option: 'showLogo' } }),
      ]),
      description,
    );

    expect(result.errors).toEqual([
      { path: 'content.children[4].styleName', message: 'settings không có style "total"' },
      { path: 'content.children[5].content[0]', message: 'settings không có option "header"' },
      { path: 'content.children[6].visibleWhen', message: 'settings không có option "showLogo"' },
    ]);
  });

  it('báo lỗi dùng sai loại option', () => {
    const result = validateTemplateAgainstData(
      documentWith([
        ...USES_ALL,
        textWith('segment-boolean', { content: [{ option: 'showPrice' }] }),
        textWith('condition-text', { visibleWhen: { op: 'option', option: 'footerText' } }),
        textWith('choice-without-equals', { visibleWhen: { op: 'option', option: 'priceStyle' } }),
        textWith('boolean-with-string', { visibleWhen: { op: 'option', option: 'showPrice', equals: 'yes' } }),
        textWith('choice-outside-list', { visibleWhen: { op: 'option', option: 'priceStyle', equals: 'long' } }),
      ]),
      description,
    );

    expect(result.errors).toEqual([
      { path: 'content.children[4].content[0]', message: 'option "showPrice" không phải kiểu text' },
      {
        path: 'content.children[5].visibleWhen',
        message: 'option "footerText" kiểu text không dùng được trong điều kiện',
      },
      { path: 'content.children[6].visibleWhen', message: 'option "priceStyle" kiểu choice cần equals' },
      { path: 'content.children[7].visibleWhen', message: 'equals của option "showPrice" phải là true hoặc false' },
      {
        path: 'content.children[8].visibleWhen',
        message: 'equals của option "priceStyle" phải là 1 trong: "short", "full"',
      },
    ]);
  });

  it('kiểm tra cả tham chiếu trong điều kiện lồng và trong repeat', () => {
    const result = validateTemplateAgainstData(
      documentWith([
        ...USES_ALL,
        {
          type: 'repeat',
          id: 'items',
          collection: 'items',
          template: textWith('item', {
            visibleWhen: { op: 'and', conditions: [{ op: 'exists', var: 'itemName' }, { op: 'option', option: 'x' }] },
          }),
        },
      ]),
      description,
    );

    expect(result.errors).toEqual([
      { path: 'content.children[4].template.visibleWhen.conditions[1]', message: 'settings không có option "x"' },
    ]);
  });

  it('cảnh báo style/option khai báo nhưng không dùng', () => {
    const onlyStyle = documentWith([textWith('name', { styleName: 'itemName' })]);
    const result = validateTemplateAgainstData(onlyStyle, description);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      { path: 'settings.options.showPrice', message: 'option "showPrice" khai báo nhưng không dùng' },
      { path: 'settings.options.footerText', message: 'option "footerText" khai báo nhưng không dùng' },
      { path: 'settings.options.priceStyle', message: 'option "priceStyle" khai báo nhưng không dùng' },
    ]);
  });
});

import {
  column,
  eq,
  gt,
  insets,
  labelTemplate,
  mm,
  parseTemplate,
  px,
  receiptTemplate,
  text,
  TemplateBuildError,
} from '../..';
import { TEST_ORDER_DATA } from '../../../testing';

function buildProductLabel() {
  return labelTemplate(TEST_ORDER_DATA)
    .metadata({ id: 'product-label-default', name: 'Tem món mặc định', paper: { widthMm: 50, heightMm: 30 } })
    .content((scope) =>
      scope
        .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
          column()
            .padding(insets(mm(2)))
            .gap(mm(1))
            .children(
              text([item.var('itemName')]).fontSize(px(16)).bold(),
              item.repeat({ collection: 'toppings' }, (topping) => text([{ text: '+ ' }, topping.var('toppingName')])),
              text([item.var('orderCode'), { text: ' · ' }, item.var('$unit'), { text: '/' }, item.var('$unitCount')]),
            ),
        )
        .maxItemsPerPage(1),
    )
    .build();
}

describe('labelTemplate / receiptTemplate', () => {
  it('build ra TemplateDocument JSON thuần đúng cấu trúc', () => {
    const template = buildProductLabel();

    expect(template).toEqual({
      schemaVersion: 1,
      metadata: {
        id: 'product-label-default',
        name: 'Tem món mặc định',
        kind: 'label',
        locale: 'vi-VN',
        paper: { widthMm: 50, heightMm: 30 },
      },
      settings: { styles: {}, options: {} },
      content: {
        type: 'repeat',
        id: 'repeat-1',
        collection: 'items',
        expand: 'quantity',
        maxItemsPerPage: 1,
        template: {
          type: 'container',
          id: 'container-2',
          style: { padding: insets(mm(2)), direction: 'column', gap: mm(1) },
          children: [
            {
              type: 'text',
              id: 'text-3',
              content: [{ var: 'itemName' }],
              style: { fontSize: px(16), fontWeight: 'bold' },
            },
            {
              type: 'repeat',
              id: 'repeat-4',
              collection: 'toppings',
              template: { type: 'text', id: 'text-5', content: [{ text: '+ ' }, { var: 'toppingName' }] },
            },
            {
              type: 'text',
              id: 'text-6',
              content: [{ var: 'orderCode' }, { text: ' · ' }, { var: '$unit' }, { text: '/' }, { var: '$unitCount' }],
            },
          ],
        },
      },
    });
  });

  it('round-trip JSON.stringify → JSON.parse → parseTemplate không mất dữ liệu', () => {
    const template = buildProductLabel();
    const result = parseTemplate(JSON.parse(JSON.stringify(template)));

    expect(result).toEqual({ ok: true, template });
  });

  it('receipt không có chiều cao giấy', () => {
    const template = receiptTemplate(TEST_ORDER_DATA)
      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
      .content((scope) => text([{ text: 'Mã đơn: ' }, scope.var('orderCode')]))
      .build();

    expect(template.metadata.kind).toBe('receipt');
    expect(template.metadata.paper).toEqual({ widthMm: 72 });
  });

  it('throw TemplateBuildError khi segment viết tay dùng biến sai scope', () => {
    const builder = receiptTemplate(TEST_ORDER_DATA)
      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
      .content(text([{ var: 'itemName' }]));

    expect(() => builder.build()).toThrow(TemplateBuildError);
    expect(() => builder.build()).toThrow('biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"');
  });

  it('không throw khi chỉ có cảnh báo deprecated', () => {
    const build = () =>
      receiptTemplate(TEST_ORDER_DATA)
        .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
        .content((scope) => scope.repeat({ collection: 'items' }, (item) => text([item.var('legacyItemName')])))
        .build();

    expect(build).not.toThrow();
  });

  it('throw khi thiếu metadata hoặc content', () => {
    const metadata = { id: 'x', name: 'x', paper: { widthMm: 72 } };

    expect(() => receiptTemplate(TEST_ORDER_DATA).content(text('x')).build()).toThrow('Template cần .metadata(...)');
    expect(() => receiptTemplate(TEST_ORDER_DATA).metadata(metadata).build()).toThrow('Template cần .content(...)');
  });

  it('settings: default bỏ trống lấy bằng value, default khai báo thì giữ nguyên', () => {
    const template = receiptTemplate(TEST_ORDER_DATA)
      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
      .settings({
        styles: { itemName: { label: 'Tên món', value: { fontSize: px(16) } } },
        options: {
          showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
          footerText: { label: 'Dòng cuối', type: 'text', value: 'Cảm ơn quý khách' },
        },
      })
      .content(text('x'))
      .build();

    expect(template.settings).toEqual({
      styles: { itemName: { label: 'Tên món', value: { fontSize: px(16) }, default: { fontSize: px(16) } } },
      options: {
        showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
        footerText: { label: 'Dòng cuối', type: 'text', value: 'Cảm ơn quý khách', default: 'Cảm ơn quý khách' },
      },
    });
    expect(parseTemplate(JSON.parse(JSON.stringify(template)))).toEqual({ ok: true, template });
  });

  it('throw TemplateBuildError khi settings không hợp lệ', () => {
    const builder = receiptTemplate(TEST_ORDER_DATA)
      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
      .settings({
        options: {
          priceStyle: { label: 'Kiểu giá', type: 'choice', choices: [{ value: 'short', label: '45k' }], value: 'full' },
        },
      })
      .content(text('x'));

    expect(() => builder.build()).toThrow('settings.options.priceStyle.value');
  });

  it('TypeScript chặn tên biến sai, biến sai scope và khổ giấy sai loại', () => {
    const checkTypesOnly = () => {
      // @ts-expect-error label bắt buộc heightMm
      labelTemplate(TEST_ORDER_DATA).metadata({ id: 'x', name: 'x', paper: { widthMm: 50 } });
      // @ts-expect-error receipt không có heightMm
      receiptTemplate(TEST_ORDER_DATA).metadata({ id: 'x', name: 'x', paper: { widthMm: 72, heightMm: 30 } });
      // @ts-expect-error thiếu name
      receiptTemplate(TEST_ORDER_DATA).metadata({ id: 'x', paper: { widthMm: 72 } });

      receiptTemplate(TEST_ORDER_DATA).content((scope) => {
        // @ts-expect-error tên biến sai
        scope.var('orderCod');
        // @ts-expect-error biến của collection không dùng được ở gốc
        scope.var('itemName');
        // @ts-expect-error collection lồng không lặp được ở gốc
        scope.repeat({ collection: 'toppings' }, () => text(''));

        return scope.repeat({ collection: 'items', expand: 'quantity' }, (item) => {
          // @ts-expect-error biến của collection con chưa dùng được
          item.var('toppingName');
          return text([item.var('itemName'), item.var('orderCode'), item.var('$position')]);
        });
      });
    };

    expect(checkTypesOnly).toBeInstanceOf(Function);
  });

  it('maxItemsPerPage trên repeat lồng và biến $part/$partCount ra đúng JSON, qua được parseTemplate', () => {
    const template = labelTemplate(TEST_ORDER_DATA)
      .metadata({ id: 'split-label', name: 'Tem tách topping', paper: { widthMm: 50, heightMm: 30 } })
      .content((scope) =>
        scope
          .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
            column().children(
              text([item.var('itemName')]).visibleWhen(eq('$part', 1)),
              item
                .repeat({ collection: 'toppings' }, (topping) => text([topping.var('toppingName')]))
                .maxItemsPerPage(4),
              text([{ text: '(tiếp ' }, item.var('$part'), { text: '/' }, item.var('$partCount'), { text: ')' }])
                .visibleWhen(gt('$partCount', 1)),
            ),
          )
          .maxItemsPerPage(1),
      )
      .build();

    const outer = template.content;
    if (outer.type !== 'repeat' || outer.template.type !== 'container') throw new Error('cấu trúc sai');
    expect(outer.template.children[1]).toMatchObject({ type: 'repeat', collection: 'toppings', maxItemsPerPage: 4 });
    expect(outer.template.children[2]).toMatchObject({ visibleWhen: { op: 'gt', var: '$partCount', value: 1 } });
    expect(parseTemplate(JSON.parse(JSON.stringify(template)))).toEqual({ ok: true, template });
  });
});

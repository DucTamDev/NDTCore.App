import {
  column,
  insets,
  labelTemplate,
  mm,
  parseTemplate,
  px,
  receiptTemplate,
  text,
  TemplateBuildError,
} from '../..';
import { TEST_ORDER_CATALOG } from '../../../testing';

function buildProductLabel() {
  return labelTemplate(TEST_ORDER_CATALOG)
    .id('product-label-default')
    .name('Tem món mặc định')
    .paper({ widthMm: 50, heightMm: 30 })
    .root((scope) =>
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
      id: 'product-label-default',
      name: 'Tem món mặc định',
      catalog: 'test-order',
      media: 'label',
      locale: 'vi-VN',
      paper: { widthMm: 50, heightMm: 30 },
      root: {
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
    const template = receiptTemplate(TEST_ORDER_CATALOG)
      .id('receipt')
      .name('Hoá đơn')
      .paper({ widthMm: 72 })
      .root((scope) => text([{ text: 'Mã đơn: ' }, scope.var('orderCode')]))
      .build();

    expect(template.media).toBe('receipt');
    expect(template.paper).toEqual({ widthMm: 72 });
  });

  it('throw TemplateBuildError khi segment viết tay dùng biến sai scope', () => {
    const builder = receiptTemplate(TEST_ORDER_CATALOG)
      .id('receipt')
      .name('Hoá đơn')
      .paper({ widthMm: 72 })
      .root(text([{ var: 'itemName' }]));

    expect(() => builder.build()).toThrow(TemplateBuildError);
    expect(() => builder.build()).toThrow('biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"');
  });

  it('không throw khi chỉ có cảnh báo deprecated', () => {
    const build = () =>
      receiptTemplate(TEST_ORDER_CATALOG)
        .id('receipt')
        .name('Hoá đơn')
        .paper({ widthMm: 72 })
        .root((scope) => scope.repeat({ collection: 'items' }, (item) => text([item.var('legacyItemName')])))
        .build();

    expect(build).not.toThrow();
  });

  it('throw khi thiếu id, name, paper hoặc root', () => {
    expect(() => receiptTemplate(TEST_ORDER_CATALOG).build()).toThrow('Template cần .id(...)');
    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').build()).toThrow('Template cần .name(...)');
    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').name('x').build()).toThrow('Template cần .paper(...)');
    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').name('x').paper({ widthMm: 72 }).build()).toThrow(
      'Template cần .root(...)',
    );
  });

  it('TypeScript chặn tên biến sai, biến sai scope và khổ giấy sai loại', () => {
    const checkTypesOnly = () => {
      // @ts-expect-error label bắt buộc heightMm
      labelTemplate(TEST_ORDER_CATALOG).paper({ widthMm: 50 });
      // @ts-expect-error receipt không có heightMm
      receiptTemplate(TEST_ORDER_CATALOG).paper({ widthMm: 72, heightMm: 30 });

      receiptTemplate(TEST_ORDER_CATALOG).root((scope) => {
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
});

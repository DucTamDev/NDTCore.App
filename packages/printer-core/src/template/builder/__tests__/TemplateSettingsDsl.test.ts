import { and, column, eq, parseTemplate, px, receiptTemplate, text } from '../..';
import { TEST_ORDER_DATA } from '../../../testing';

function receiptWithSettings() {
  return receiptTemplate(TEST_ORDER_DATA)
    .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
    .settings({
      styles: { itemName: { label: 'Tên món', value: { fontSize: px(16), fontWeight: 'bold' } } },
      options: {
        showPrice: { label: 'In giá món', type: 'boolean', value: true },
        footerText: { label: 'Dòng cuối', type: 'text', value: 'Cảm ơn quý khách' },
        priceStyle: {
          label: 'Kiểu giá',
          type: 'choice',
          choices: [
            { value: 'short', label: '45k' },
            { value: 'full', label: '45.000đ' },
          ],
          value: 'full',
        },
      },
    });
}

describe('DSL settings: scope.style / option / optionIs', () => {
  it('sinh đúng JSON tham chiếu và qua được parseTemplate', () => {
    const template = receiptWithSettings()
      .content((scope) =>
        column().children(
          text([scope.var('orderCode')]).style(scope.style('itemName')),
          text('Giá').visibleWhen(scope.optionIs('showPrice')),
          text('Giá đầy đủ').visibleWhen(and(scope.optionIs('priceStyle', 'full'), eq('$page', 1))),
          text([scope.option('footerText')]),
        ),
      )
      .build();

    if (template.content.type !== 'container') throw new Error('cấu trúc sai');
    expect(template.content.children).toEqual([
      expect.objectContaining({ styleName: 'itemName' }),
      expect.objectContaining({ visibleWhen: { op: 'option', option: 'showPrice' } }),
      expect.objectContaining({
        visibleWhen: {
          op: 'and',
          conditions: [
            { op: 'option', option: 'priceStyle', equals: 'full' },
            { op: 'eq', var: '$page', value: 1 },
          ],
        },
      }),
      expect.objectContaining({ content: [{ option: 'footerText' }] }),
    ]);
    expect(parseTemplate(JSON.parse(JSON.stringify(template)))).toEqual({ ok: true, template });
  });

  it('scope trong repeat vẫn dùng được settings', () => {
    const template = receiptWithSettings()
      .content((scope) =>
        column().children(
          scope.repeat({ collection: 'items' }, (item) =>
            text([item.var('itemName')]).style(item.style('itemName')).visibleWhen(item.optionIs('showPrice')),
          ),
          text([scope.option('footerText')]).visibleWhen(scope.optionIs('priceStyle', 'short')),
        ),
      )
      .build();

    expect(template.content).toMatchObject({
      children: [
        { template: { styleName: 'itemName', visibleWhen: { op: 'option', option: 'showPrice' } } },
        { content: [{ option: 'footerText' }], visibleWhen: { op: 'option', option: 'priceStyle', equals: 'short' } },
      ],
    });
  });

  it('TypeScript chặn tên style/option sai và dùng sai loại option', () => {
    const checkTypesOnly = () => {
      receiptWithSettings().content((scope) => {
        // @ts-expect-error style không khai báo
        scope.style('total');
        // @ts-expect-error option boolean không in được thành chữ
        scope.option('showPrice');
        // @ts-expect-error option text không dùng được trong điều kiện
        scope.optionIs('footerText');
        // @ts-expect-error option choice cần equals
        scope.optionIs('priceStyle');
        // @ts-expect-error option boolean so với boolean, không so với chuỗi
        scope.optionIs('showPrice', 'yes');
        return text('x');
      });
      // @ts-expect-error template không khai báo settings thì không có style nào
      receiptTemplate(TEST_ORDER_DATA).content((scope) => text('x').style(scope.style('itemName')));
    };

    expect(checkTypesOnly).toBeInstanceOf(Function);
  });

  it('build báo lỗi khi text vừa dùng style có tên vừa đặt cỡ chữ viết thẳng', () => {
    const builder = receiptWithSettings().content((scope) =>
      column().children(
        text('x').style(scope.style('itemName')).fontSize(px(10)),
        text('Giá').visibleWhen(scope.optionIs('showPrice')),
        text([scope.option('footerText')]).visibleWhen(scope.optionIs('priceStyle', 'full')),
      ),
    );

    expect(() => builder.build()).toThrow('không dùng cùng styleName');
  });
});

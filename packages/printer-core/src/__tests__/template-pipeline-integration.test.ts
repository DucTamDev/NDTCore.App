import { EscPosCompiler } from '../language';
import { ApproximateFontMetrics, createLayoutEngine, paperSizeToDots } from '../layout';
import { collectAssetIds, createDocumentResolver, type AssetProvider } from '../resolution';
import {
  barcode,
  column,
  eq,
  gt,
  image,
  labelTemplate,
  line,
  mm,
  parseTemplate,
  px,
  receiptTemplate,
  row,
  text,
} from '../template';
import { TEST_ORDER_DATA, TEST_ORDER_SAMPLE, type TestOrder } from '../testing';
import type { Bitmap } from '../types';

// Không có @types/node trong package RN; require() chỉ dùng để khẳng định module cũ đã bị xoá.
declare function require(id: string): unknown;

const LOGO: Bitmap = { data: new Uint8Array(8), width: 8, height: 8, bytesPerRow: 1 };
const PRINTER_DPI = 203;

function buildReceipt() {
  return receiptTemplate(TEST_ORDER_DATA)
    .metadata({ id: 'receipt-default', name: 'Hoá đơn mặc định', paper: { widthMm: 72 } })
    .content((scope) =>
      column()
        .gap(mm(1))
        .children(
          image(scope.var('storeLogo')),
          text([{ text: 'Bàn ' }, scope.var('tableName')]).fontSize(px(16)).bold(),
          line().dashed(),
          scope.repeat({ collection: 'items' }, (item) =>
            row().justifyContent('space-between').children(text([item.var('itemName')]), text([item.var('itemTotal')])),
          ),
          text([{ text: 'Giảm giá ' }, scope.var('discount')]).visibleWhen(gt('discount', 0)),
          barcode([scope.var('orderCode')], 'code128').barHeight(mm(8)),
        ),
    )
    .build();
}

describe('pipeline template → resolve → layout → compile', () => {
  it('DSL → JSON (round-trip) → resolve với dữ liệu template → layout 203 dpi → byte ESC/POS', () => {
    const parsed = parseTemplate(JSON.parse(JSON.stringify(buildReceipt())));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const template = parsed.template;

    expect(collectAssetIds(template, TEST_ORDER_DATA, TEST_ORDER_SAMPLE)).toEqual(['store-logo@v1']);
    const assets: AssetProvider = { get: (assetId) => (assetId === 'store-logo@v1' ? LOGO : undefined) };

    const resolveOptions = { templateData: TEST_ORDER_DATA, assets };
    const pages = createDocumentResolver().resolve(template, TEST_ORDER_SAMPLE, resolveOptions);
    expect(pages).toHaveLength(1);
    if (pages[0].status !== 'ok') throw new Error(pages[0].message);

    const config = { paper: template.metadata.paper, dpi: PRINTER_DPI };
    const { elements } = createLayoutEngine().resolve(pages[0].node, config, new ApproximateFontMetrics());

    expect(elements.some((element) => element.type === 'text' && element.content === 'Bàn Bàn 5')).toBe(true);
    expect(elements.some((element) => element.type === 'text' && element.content === 'Giảm giá 5.000đ')).toBe(true);
    expect(elements).toContainEqual(
      expect.objectContaining({ type: 'table', options: expect.objectContaining({ rows: [['Trà sữa', '135.000đ']] }) }),
    );
    expect(elements.filter((element) => element.type === 'line').length).toBeGreaterThan(1);
    expect(elements).toContainEqual(
      expect.objectContaining({ type: 'barcode', options: expect.objectContaining({ height: 64 }) }),
    );

    const paper = paperSizeToDots(template.metadata.paper, PRINTER_DPI);
    const bytes = new EscPosCompiler().compile({
      widthDots: paper.widthDots,
      heightDots: paper.heightDots ?? 0,
      dpi: PRINTER_DPI,
      gapDots: 0,
      speed: 4,
      density: 8,
      direction: 'forward',
      copies: 1,
      elements,
    }).output;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('templates/ và binding/ cũ không còn import được', () => {
    expect(() => require('../templates')).toThrow();
    expect(() => require('../binding')).toThrow();
  });

  it('tem món nhiều topping tách sang tem tiếp: JSON round-trip → resolve → layout từng tem', () => {
    const built = labelTemplate(TEST_ORDER_DATA)
      .metadata({ id: 'split-label', name: 'Tem tách topping', paper: { widthMm: 50, heightMm: 30 } })
      .content((scope) =>
        scope
          .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
            column().children(
              text([item.var('itemName')]).bold(),
              text([item.var('itemTotal')]).visibleWhen(eq('$part', 1)),
              item
                .repeat({ collection: 'toppings' }, (topping) => text([topping.var('toppingName')]))
                .maxItemsPerPage(2),
              text([{ text: '(tiếp ' }, item.var('$part'), { text: '/' }, item.var('$partCount'), { text: ')' }])
                .visibleWhen(gt('$partCount', 1)),
            ),
          )
          .maxItemsPerPage(1),
      )
      .build();
    const parsed = parseTemplate(JSON.parse(JSON.stringify(built)));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const template = parsed.template;

    const toppings = ['Trân châu', 'Thạch dừa', 'Pudding', 'Kem cheese', 'Nha đam'].map(name => ({
      name,
      price: 5000,
    }));
    const order: TestOrder = {
      ...TEST_ORDER_SAMPLE,
      items: [{ name: 'Trà sữa', quantity: 1, price: 45000, toppings }],
    };
    const pages = createDocumentResolver().resolve(template, order, {
      templateData: TEST_ORDER_DATA,
      assets: { get: () => undefined },
    });

    const config = { paper: template.metadata.paper, dpi: PRINTER_DPI };
    const texts = pages.map((page) => {
      if (page.status !== 'ok') throw new Error(page.message);
      const { elements } = createLayoutEngine().resolve(page.node, config, new ApproximateFontMetrics());
      return elements.flatMap((element) => (element.type === 'text' ? [element.content] : []));
    });
    expect(texts).toEqual([
      ['Trà sữa', '45.000đ', 'Trân châu', 'Thạch dừa', '(tiếp 1/3)'],
      ['Trà sữa', 'Pudding', 'Kem cheese', '(tiếp 2/3)'],
      ['Trà sữa', 'Nha đam', '(tiếp 3/3)'],
    ]);
  });
});

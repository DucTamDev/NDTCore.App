import { EscPosCompiler } from '../language';
import { ApproximateFontMetrics, createLayoutEngine, paperSizeToDots, type TypographyProfile } from '../layout';
import { collectAssetIds, createDocumentResolver, type AssetProvider } from '../resolution';
import { barcode, column, gt, image, line, mm, parseTemplate, px, receiptTemplate, row, text } from '../template';
import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE } from '../testing';
import type { Bitmap } from '../types';

// Không có @types/node trong package RN; require() chỉ dùng để khẳng định module cũ đã bị xoá.
declare function require(id: string): unknown;

const LOGO: Bitmap = { data: new Uint8Array(8), width: 8, height: 8, bytesPerRow: 1 };
const TYPOGRAPHY: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };
const PRINTER_DPI = 203;

function buildReceipt() {
  return receiptTemplate(TEST_ORDER_CATALOG)
    .id('receipt-default')
    .name('Hoá đơn mặc định')
    .paper({ widthMm: 72 })
    .root((scope) =>
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
  it('DSL → JSON (round-trip) → resolve với catalog → layout 203 dpi → byte ESC/POS', () => {
    const parsed = parseTemplate(JSON.parse(JSON.stringify(buildReceipt())));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const template = parsed.template;

    expect(collectAssetIds(template, TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE)).toEqual(['store-logo@v1']);
    const assets: AssetProvider = { get: (assetId) => (assetId === 'store-logo@v1' ? LOGO : undefined) };

    const resolveOptions = { catalog: TEST_ORDER_CATALOG, assets };
    const pages = createDocumentResolver().resolve(template, TEST_ORDER_SAMPLE, resolveOptions);
    expect(pages).toHaveLength(1);
    if (pages[0].status !== 'ok') throw new Error(pages[0].message);

    const config = { paper: template.paper, media: template.media, dpi: PRINTER_DPI };
    const elements = createLayoutEngine().resolve(pages[0].node, config, TYPOGRAPHY, new ApproximateFontMetrics());

    expect(elements.some((element) => element.type === 'text' && element.content === 'Bàn Bàn 5')).toBe(true);
    expect(elements.some((element) => element.type === 'text' && element.content === 'Giảm giá 5.000đ')).toBe(true);
    expect(elements).toContainEqual(
      expect.objectContaining({ type: 'table', options: expect.objectContaining({ rows: [['Trà sữa', '135.000đ']] }) }),
    );
    expect(elements.filter((element) => element.type === 'line').length).toBeGreaterThan(1);
    expect(elements).toContainEqual(
      expect.objectContaining({ type: 'barcode', options: expect.objectContaining({ height: 64 }) }),
    );

    const paper = paperSizeToDots(template.paper, PRINTER_DPI);
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
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('templates/ và binding/ cũ không còn import được', () => {
    expect(() => require('../templates')).toThrow();
    expect(() => require('../binding')).toThrow();
  });
});

import { labelTemplate, column, row, text, line, barcode, repeat } from '../template';
import { createDocumentResolver } from '../resolution';
import { createLayoutEngine, ApproximateFontMetrics } from '../layout';
import type { TypographyProfile } from '../layout';
import { EscPosCompiler } from '../language/escpos/EscPosCompiler';

// No @types/node in this RN package; require() is only used to assert a module is gone.
declare function require(id: string): unknown;

describe('layout engine end-to-end', () => {
  it('builds a label via the DSL, resolves real data, lays it out, and compiles to ESC/POS bytes', () => {
    const template = labelTemplate()
      .size({ widthDots: 400, heightDots: 240, dpi: 203 })
      .root(
        column()
          .gap(4)
          .children(
            text.binding('product.name').fontSize(24).bold(),
            row().children(text.binding('product.price')),
            line(),
            repeat('toppings').template(row().children(text.literal('- '), text.binding('name'))),
            barcode.binding('order.code').symbology('code128'),
          ),
      )
      .build();

    const data = {
      product: { name: 'Milk Tea', price: '45,000' },
      toppings: [{ name: 'Pearl' }, { name: 'Cheese Foam' }],
      order: { code: 'ORD123' },
    };

    const resolver = createDocumentResolver();
    const pages = resolver.resolve(template, data);
    expect(pages).toHaveLength(1);
    expect(pages[0].status).toBe('ok');
    if (pages[0].status !== 'ok') return;

    const layoutEngine = createLayoutEngine();
    const fontMetrics = new ApproximateFontMetrics();
    const typography: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };
    const elements = layoutEngine.resolve(pages[0].node, template.config, typography, fontMetrics);

    expect(elements.some((e) => e.type === 'text' && e.content === 'Milk Tea')).toBe(true);
    expect(elements.some((e) => e.type === 'barcode')).toBe(true);

    const bytes = new EscPosCompiler().compile({
      ...template.config,
      heightDots: template.config.heightDots ?? 0,
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

  it('templates/ and binding/ no longer exist as importable modules', () => {
    expect(() => require('../templates')).toThrow();
    expect(() => require('../binding')).toThrow();
  });
});

import { ZplPreviewRenderer } from '../ZplPreviewRenderer';
import type { ResolvedPrintDocument } from '../../../document';

const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
  widthDots: 320,
  heightDots: 240,
  dpi: 203,
  gapDots: 24,
  speed: 4,
  density: 8,
  direction: 'forward',
  copies: 1,
};

describe('ZplPreviewRenderer', () => {
  it('renders an SVG wrapper sized from the document dots, with an escaped label', () => {
    const renderer = new ZplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [] });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="340"'); // 320 + 2*10 padding
    expect(svg).toContain('320×240 dots (203 DPI) — ZPL');
  });

  it('renders a text element as an SVG <text>, escaping markup-significant characters', () => {
    const renderer = new ZplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'text', content: 'A & B < C', options: { x: 5, y: 5 } }] });

    expect(svg).toContain('<text x="5"');
    expect(svg).toContain('A &amp; B &lt; C');
  });

  it('renders a filled box when thickness covers the shorter side', () => {
    const renderer = new ZplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'box', options: { x: 0, y: 0, width: 20, height: 20, thickness: 20 } }] });

    expect(svg).toContain('<rect x="0" y="0" width="20" height="20" fill="#000"');
  });

  it('renders a diagonal element as an SVG <line>', () => {
    const renderer = new ZplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });

    expect(svg).toContain('<line x1="0" y1="0" x2="100" y2="50" stroke="#000" stroke-width="2"/>');
  });

  it('renders a barcode element as a striped placeholder plus its human-readable content', () => {
    const renderer = new ZplPreviewRenderer();
    const svg = renderer.preview({
      ...baseDoc,
      elements: [{ type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789', height: 50 } }],
    });

    expect(svg).toContain('<pattern id="zpl-barcode-5-5"');
    expect(svg).toContain('123456789');
  });

  it('omits the barcode human-readable label when readable is explicitly false', () => {
    const renderer = new ZplPreviewRenderer();
    const svg = renderer.preview({
      ...baseDoc,
      elements: [{ type: 'barcode', options: { x: 0, y: 0, symbology: 'code39', content: 'ABC', readable: false } }],
    });

    expect(svg).not.toContain('>ABC<');
  });

  it('renders a qrcode element as a finder-pattern placeholder plus its content', () => {
    const renderer = new ZplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'qrcode', options: { x: 10, y: 10, content: 'hello' } }] });

    expect(svg).toContain('hello');
    // 3 finder-pattern corner squares + 1 outer boundary rect from the qrcode
    // element, plus the SVG wrapper's own 2 background/canvas rects.
    expect(svg.match(/<rect/g)?.length).toBe(6);
  });

  it('renders a table element into stacked <text> rows carrying its cell content', () => {
    const renderer = new ZplPreviewRenderer();
    const svg = renderer.preview({
      ...baseDoc,
      elements: [
        {
          type: 'table',
          options: {
            x: 5,
            y: 20,
            columns: [{ width: 10 }, { width: 10 }],
            rows: [
              ['hello', 'world'],
              ['foo', 'bar'],
            ],
          },
        },
      ],
    });

    expect(svg).toContain('hello');
    expect(svg).toContain('world');
    expect(svg).toContain('foo');
    expect(svg).toContain('bar');
    // 2 table rows, plus the SVG wrapper's own dots/DPI caption <text>.
    expect(svg.match(/<text/g)?.length).toBe(3);
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const renderer = new ZplPreviewRenderer();
    expect(() =>
      renderer.preview({
        ...baseDoc,
        elements: [{ type: 'table', options: { x: 0, y: 0, columns: [{ width: 10 }, { width: 0 }], rows: [['a', 'b']] } }],
      }),
    ).toThrow(/positive width/);
  });

  it('renders nothing extra for ellipse/reverse/raw/cut/pageBreak/spacer/row/column vs. an empty-elements document', () => {
    const renderer = new ZplPreviewRenderer();
    const emptySvg = renderer.preview({ ...baseDoc, elements: [] });
    const noOpSvg = renderer.preview({
      ...baseDoc,
      elements: [
        { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'raw', content: '^FO0,0^FS' },
        { type: 'cut', options: { mode: 'full' } },
        { type: 'pageBreak' },
        { type: 'spacer', options: { size: 10 } },
        { type: 'row', options: {} },
        { type: 'column', options: {} },
      ],
    });

    expect(noOpSvg).toBe(emptySvg);
  });
});

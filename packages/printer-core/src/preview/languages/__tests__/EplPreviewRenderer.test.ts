import { EplPreviewRenderer } from '../EplPreviewRenderer';
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

describe('EplPreviewRenderer', () => {
  it('renders an SVG wrapper sized from the document dots, with the EPL caption', () => {
    const renderer = new EplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [] });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="340"'); // 320 + 2*10 padding
    expect(svg).toContain('320×240 dots — EPL');
  });

  it('renders a text element as an SVG <text>, escaping markup-significant characters', () => {
    const renderer = new EplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'text', content: 'A & B < C', options: { x: 5, y: 5 } }] });

    expect(svg).toContain('<text x="5"');
    expect(svg).toContain('A &amp; B &lt; C');
  });

  it('renders reverse text as a filled rect behind white text', () => {
    const renderer = new EplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'text', content: 'Rev', options: { x: 0, y: 0, reverse: true } }] });

    expect(svg).toContain('fill="#000"');
    expect(svg).toContain('fill="#fff"');
  });

  it('renders a filled box when thickness covers the shorter side', () => {
    const renderer = new EplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'box', options: { x: 0, y: 0, width: 20, height: 20, thickness: 20 } }] });

    expect(svg).toContain('<rect x="0" y="0" width="20" height="20" fill="#000"/>');
  });

  it('renders a genuinely diagonal line element as an SVG <line>, matching portakal\'s own preview behavior', () => {
    const renderer = new EplPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });

    expect(svg).toContain('<line x1="0" y1="0" x2="100" y2="50" stroke="#000" stroke-width="2"/>');
  });

  it('renders a table element into stacked <text> rows carrying its cell content', () => {
    const renderer = new EplPreviewRenderer();
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
    // 2 table rows, plus the SVG wrapper's own dots caption <text>.
    expect(svg.match(/<text/g)?.length).toBe(3);
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const renderer = new EplPreviewRenderer();
    expect(() =>
      renderer.preview({
        ...baseDoc,
        elements: [{ type: 'table', options: { x: 0, y: 0, columns: [{ width: 10 }, { width: 0 }], rows: [['a', 'b']] } }],
      }),
    ).toThrow(/positive width/);
  });

  it('renders nothing extra for circle/ellipse/reverse/erase/image/raw, matching portakal\'s own EPL preview limitation exactly', () => {
    const renderer = new EplPreviewRenderer();
    const emptySvg = renderer.preview({ ...baseDoc, elements: [] });
    const noOpSvg = renderer.preview({
      ...baseDoc,
      elements: [
        { type: 'circle', options: { x: 0, y: 0, diameter: 10 } },
        { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'image', bitmap: { data: new Uint8Array([0xff]), width: 8, height: 1, bytesPerRow: 1 }, options: {} },
        { type: 'raw', content: 'OD' },
      ],
    });

    expect(noOpSvg).toBe(emptySvg);
  });

  it('renders nothing extra for barcode/qrcode/cut/pageBreak/spacer/row/column vs. an empty-elements document', () => {
    const renderer = new EplPreviewRenderer();
    const emptySvg = renderer.preview({ ...baseDoc, elements: [] });
    const noOpSvg = renderer.preview({
      ...baseDoc,
      elements: [
        { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
        { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
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

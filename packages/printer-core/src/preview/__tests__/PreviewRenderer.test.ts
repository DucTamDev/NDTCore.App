import { renderPreview } from '../PreviewRenderer';
import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';

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

describe('renderPreview (shared default SVG renderer)', () => {
  it('renders an SVG wrapper sized from the document dots, with a dots/DPI caption', () => {
    const svg = renderPreview({ ...baseDoc, elements: [] });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="340"'); // 320 + 2*10 padding
    expect(svg).toContain('320×240 dots (203 DPI)');
  });

  it('renders a text element as an SVG <text>, escaping markup-significant characters', () => {
    const svg = renderPreview({ ...baseDoc, elements: [{ type: 'text', content: 'A & B < C', options: { x: 5, y: 5 } }] });

    expect(svg).toContain('<text x="5"');
    expect(svg).toContain('A &amp; B &lt; C');
  });

  it('renders a box element as an SVG <rect>', () => {
    const svg = renderPreview({ ...baseDoc, elements: [{ type: 'box', options: { x: 0, y: 0, width: 20, height: 20, thickness: 20 } }] });

    expect(svg).toContain('<rect x="0" y="0" width="20" height="20" fill="#000"');
  });

  it('renders a genuinely diagonal line element as an SVG <line>', () => {
    const svg = renderPreview({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });

    expect(svg).toContain('<line x1="0" y1="0" x2="100" y2="50" stroke="#000" stroke-width="2"/>');
  });

  it('renders a table element into stacked <text> rows carrying its cell content', () => {
    const svg = renderPreview({
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
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    expect(() =>
      renderPreview({
        ...baseDoc,
        elements: [{ type: 'table', options: { x: 0, y: 0, columns: [{ width: 10 }, { width: 0 }], rows: [['a', 'b']] } }],
      }),
    ).toThrow(/positive width/);
  });

  it('produces identical output for pageBreak/spacer/row/column/cut no-ops vs. an empty-elements baseline', () => {
    const emptySvg = renderPreview({ ...baseDoc, elements: [] });

    const noOpElements: PrintElement[] = [
      { type: 'pageBreak' },
      { type: 'spacer', options: { size: 10 } },
      { type: 'row', options: {} },
      { type: 'column', options: {} },
      { type: 'cut', options: { mode: 'full' } },
    ];
    for (const el of noOpElements) {
      const svg = renderPreview({ ...baseDoc, elements: [el] });
      expect(svg).toBe(emptySvg);
    }
  });

  it('produces identical output for barcode/qrcode no-ops vs. an empty-elements baseline, matching the absence of any barcode/QR rendering in portakal\'s shared preview', () => {
    const emptySvg = renderPreview({ ...baseDoc, elements: [] });

    const noOpElements: PrintElement[] = [
      { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
      { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
    ];
    for (const el of noOpElements) {
      const svg = renderPreview({ ...baseDoc, elements: [el] });
      expect(svg).toBe(emptySvg);
    }
  });

  it('previews an image element without throwing', () => {
    expect(() =>
      renderPreview({
        ...baseDoc,
        elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff]), width: 8, height: 1, bytesPerRow: 1 } }],
      }),
    ).not.toThrow();
  });
});

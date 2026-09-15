import { CpclPreviewRenderer } from '../CpclPreviewRenderer';
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

describe('CpclPreviewRenderer', () => {
  it('renders an SVG wrapper sized from the document dots, with the CPCL caption', () => {
    const renderer = new CpclPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [] });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="340"'); // 320 + 2*10 padding
    expect(svg).toContain('320×240 dots — CPCL');
  });

  it('renders a text element as an SVG <text>, escaping markup-significant characters', () => {
    const renderer = new CpclPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'text', content: 'A & B < C', options: { x: 5, y: 5 } }] });

    expect(svg).toContain('<text x="5"');
    expect(svg).toContain('A &amp; B &lt; C');
  });

  it('renders a box as a stroked rect', () => {
    const renderer = new CpclPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'box', options: { x: 0, y: 0, width: 20, height: 20, thickness: 2 } }] });

    expect(svg).toContain('<rect x="1" y="1" width="18" height="18" fill="none" stroke="#000" stroke-width="2"/>');
  });

  it('renders a line element as an SVG <line>', () => {
    const renderer = new CpclPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'line', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });

    expect(svg).toContain('<line x1="0" y1="0" x2="100" y2="50" stroke="#000" stroke-width="2"/>');
  });

  it('renders a diagonal element the same way as line, since CPCL LINE draws between any two points', () => {
    const renderer = new CpclPreviewRenderer();
    const svg = renderer.preview({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });

    expect(svg).toContain('<line x1="0" y1="0" x2="100" y2="50" stroke="#000" stroke-width="2"/>');
  });

  it('renders nothing extra for circle/ellipse/reverse/erase/image/raw, matching portakal\'s own CPCL preview limitation exactly', () => {
    const renderer = new CpclPreviewRenderer();
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

  it('renders nothing extra for barcode/qrcode/cut/table/pageBreak/spacer/row/column vs. an empty-elements document', () => {
    const renderer = new CpclPreviewRenderer();
    const emptySvg = renderer.preview({ ...baseDoc, elements: [] });
    const noOpSvg = renderer.preview({
      ...baseDoc,
      elements: [
        { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
        { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
        { type: 'cut', options: { mode: 'full' } },
        { type: 'table', options: { x: 0, y: 0, columns: [{ width: 10 }], rows: [['a']] } },
        { type: 'pageBreak' },
        { type: 'spacer', options: { size: 10 } },
        { type: 'row', options: {} },
        { type: 'column', options: {} },
      ],
    });

    expect(noOpSvg).toBe(emptySvg);
  });
});

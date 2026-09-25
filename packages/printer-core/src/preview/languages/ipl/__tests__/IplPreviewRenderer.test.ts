import { IplPreviewRenderer } from '../IplPreviewRenderer';
import type { ResolvedPrintDocument } from '../../../../document';

const baseDoc: ResolvedPrintDocument = {
  widthDots: 320,
  heightDots: 240,
  dpi: 203,
  gapDots: 24,
  speed: 4,
  density: 8,
  direction: 'forward',
  copies: 1,
  elements: [{ type: 'text', content: 'Hi', options: { x: 5, y: 5 } }],
};

describe('IplPreviewRenderer', () => {
  it('vẽ chữ với chiều cao IPL thật in ra cho fontSize 30', () => {
    const doc: ResolvedPrintDocument = {
      ...baseDoc,
      elements: [{ type: 'text', content: 'Hi', options: { x: 5, y: 5, fontSize: 30 } }],
    };

    const svg = new IplPreviewRenderer().preview(doc);

    expect(svg).toContain('font-size="30"');
  });

  it('renders a non-empty SVG containing the text content', () => {
    const svg = new IplPreviewRenderer().preview(baseDoc);

    expect(svg).toContain('<svg');
    expect(svg).toContain('Hi');
  });
});

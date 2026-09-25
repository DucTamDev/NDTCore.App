import { DplPreviewRenderer } from '../DplPreviewRenderer';
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

describe('DplPreviewRenderer', () => {
  it('vẽ chữ với chiều cao DPL thật in ra cho fontSize 30 (làm tròn lên hệ số 3)', () => {
    const doc: ResolvedPrintDocument = {
      ...baseDoc,
      elements: [{ type: 'text', content: 'Hi', options: { x: 5, y: 5, fontSize: 30 } }],
    };

    const svg = new DplPreviewRenderer().preview(doc);

    expect(svg).toContain('font-size="36"');
  });

  it('renders a non-empty SVG containing the text content', () => {
    const svg = new DplPreviewRenderer().preview(baseDoc);

    expect(svg).toContain('<svg');
    expect(svg).toContain('Hi');
  });
});

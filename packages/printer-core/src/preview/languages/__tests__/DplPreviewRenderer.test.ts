import { DplPreviewRenderer } from '../DplPreviewRenderer';
import { renderPreview } from '../../PreviewRenderer';
import type { ResolvedPrintDocument } from '../../../document';

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
  it('delegates straight to the shared renderPreview(), with no DPL-specific customization', () => {
    const svg = new DplPreviewRenderer().preview(baseDoc);

    expect(svg).toBe(renderPreview(baseDoc));
  });

  it('renders a non-empty SVG containing the text content', () => {
    const svg = new DplPreviewRenderer().preview(baseDoc);

    expect(svg).toContain('<svg');
    expect(svg).toContain('Hi');
  });
});

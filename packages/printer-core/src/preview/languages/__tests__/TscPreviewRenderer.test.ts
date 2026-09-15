import { TscPreviewRenderer } from '../TscPreviewRenderer';
import type { PrintElement } from '../../../builder';

describe('TscPreviewRenderer', () => {
  it('renders a <line> element for a diagonal, not a <rect>', () => {
    const svg = new TscPreviewRenderer().preview({
      widthDots: 400, heightDots: 300, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } }],
    });
    expect(svg).toContain('<line');
  });

  it('renders table row content as text', () => {
    const svg = new TscPreviewRenderer().preview({
      widthDots: 400, heightDots: 300, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [{ type: 'table', options: { x: 0, y: 0, columns: [{ width: 10 }], rows: [['hello']] } }],
    });
    expect(svg).toContain('hello');
  });

  it('renders nothing for cut/pageBreak/spacer/row/column', () => {
    const base = new TscPreviewRenderer().preview({
      widthDots: 400, heightDots: 300, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1, elements: [],
    });
    // Explicit `PrintElement[]` annotation (rather than inferring the array's
    // type from its literal) avoids a TS inference quirk where a heterogeneous
    // array literal unifies each element's `options` shape across siblings,
    // producing a synthetic type that then fails weak-type checking against
    // e.g. `RowOptions`/`ColumnOptions` even though `{}` alone is valid.
    const noOpElements: PrintElement[] = [{ type: 'cut' as const }, { type: 'pageBreak' as const }, { type: 'spacer' as const, options: { size: 5 } }, { type: 'row' as const, options: {} }, { type: 'column' as const, options: {} }];
    for (const el of noOpElements) {
      const svg = new TscPreviewRenderer().preview({
        widthDots: 400, heightDots: 300, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
        elements: [el],
      });
      expect(svg).toBe(base);
    }
  });
});

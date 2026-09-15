import { EscPosPreviewRenderer } from '../EscPosPreviewRenderer';

describe('EscPosPreviewRenderer', () => {
  it('previews a text element with no options field without throwing', () => {
    expect(() =>
      new EscPosPreviewRenderer().preview({
        widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
        elements: [{ type: 'text', content: 'x' }],
      }),
    ).not.toThrow();
  });

  it('renders the text element content when no options field is present', () => {
    const svg = new EscPosPreviewRenderer().preview({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'text', content: 'hi' }],
    });
    expect(svg).toContain('hi');
  });

  it('ignores non-text elements', () => {
    const svg = new EscPosPreviewRenderer().preview({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'cut', options: { mode: 'full' } }],
    });
    expect(svg).toContain('<svg');
  });
});

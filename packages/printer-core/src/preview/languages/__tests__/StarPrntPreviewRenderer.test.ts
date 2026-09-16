import { StarPrntPreviewRenderer } from '../StarPrntPreviewRenderer';

const BASE = { widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward' as const, copies: 1 };

describe('StarPrntPreviewRenderer', () => {
  it('previews a text element with no options field without throwing', () => {
    expect(() => new StarPrntPreviewRenderer().preview({ ...BASE, elements: [{ type: 'text', content: 'x' }] })).not.toThrow();
  });

  it('renders the text element content', () => {
    const svg = new StarPrntPreviewRenderer().preview({ ...BASE, elements: [{ type: 'text', content: 'hi' }] });
    expect(svg).toContain('hi');
    expect(svg).toContain('<svg');
  });

  it('ignores non-text elements', () => {
    const svg = new StarPrntPreviewRenderer().preview({ ...BASE, elements: [{ type: 'cut', options: { mode: 'full' } }] });
    expect(svg).toContain('<svg');
  });

  it('renders bold text with font-weight bold', () => {
    const svg = new StarPrntPreviewRenderer().preview({ ...BASE, elements: [{ type: 'text', content: 'B', options: { bold: true } }] });
    expect(svg).toContain('font-weight="bold"');
  });

  it('does not render underline or reverse styling, matching the pre-existing portakal preview gap', () => {
    const svg = new StarPrntPreviewRenderer().preview({
      ...BASE,
      elements: [{ type: 'text', content: 'U', options: { underline: true, reverse: true } }],
    });
    expect(svg).not.toContain('text-decoration');
    // ESC/POS's renderer draws a black background rect for a reverse-print run
    // (`fill="#000"/>`) followed by white text; Star PRNT's ported renderer has
    // no such handling — the text stays plain black-on-white, no `fill="#000"/>` box.
    expect(svg).not.toContain('fill="#000"/>');
  });
});

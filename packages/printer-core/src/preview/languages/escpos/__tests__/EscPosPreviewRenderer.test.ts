import { EscPosPreviewRenderer } from '../EscPosPreviewRenderer';

describe('EscPosPreviewRenderer', () => {
  it('cắt nội dung vượt chiều rộng giấy; chiều cao giấy cuộn vẫn dài theo nội dung', () => {
    const svg = new EscPosPreviewRenderer().preview({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'text', content: 'W'.repeat(200) }],
    });

    expect(svg).toMatch(/<svg x="5" y="5" width="384" height="\d+" overflow="hidden">/);
  });

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

  it('vẽ chữ với chiều cao ESC/POS thật in ra cho fontSize 50 (làm tròn về hệ số 2)', () => {
    const svg = new EscPosPreviewRenderer().preview({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'text', content: 'hi', options: { fontSize: 50 } }],
    });

    expect(svg).toContain('font-size="48"');
  });
});

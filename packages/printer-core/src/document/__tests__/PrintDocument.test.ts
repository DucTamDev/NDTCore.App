import type { PrintElement, ResolvedPrintDocument } from '../index';

describe('PrintDocument element union', () => {
  it('accepts a barcode element alongside portakal-native element types', () => {
    const elements: PrintElement[] = [
      { type: 'text', content: 'hi', options: {} },
      { type: 'barcode', options: {} as never },
    ];
    expect(elements).toHaveLength(2);
  });

  it('describes a resolved document with dot-based measurements', () => {
    const resolved: ResolvedPrintDocument = {
      widthDots: 320, heightDots: 0, dpi: 203, gapDots: 24,
      speed: 4, density: 8, direction: 0, copies: 1, elements: [],
    };
    expect(resolved.widthDots).toBeGreaterThan(0);
  });
});

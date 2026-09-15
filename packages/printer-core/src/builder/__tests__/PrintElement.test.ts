import type { PrintElement } from '../PrintElement';

describe('PrintElement', () => {
  it('narrows to the right shape per discriminant across all 18 variants', () => {
    const elements: PrintElement[] = [
      { type: 'text', content: 'hi' },
      { type: 'image', bitmap: { data: new Uint8Array(), width: 1, height: 1, bytesPerRow: 1 } },
      { type: 'barcode', options: { symbology: 'code128', content: 'A' } },
      { type: 'qrcode', options: { content: 'A' } },
      { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'line', options: { x1: 0, y1: 0, x2: 10, y2: 0 } },
      { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
      { type: 'circle', options: { x: 0, y: 0, diameter: 10 } },
      { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 5 } },
      { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'raw', content: 'RAW' },
      { type: 'cut' },
      { type: 'table', options: { columns: [{ width: 10 }], rows: [['a']] } },
      { type: 'pageBreak' },
      { type: 'spacer', options: { size: 10 } },
      { type: 'row', options: {} },
      { type: 'column', options: {} },
    ];
    expect(elements).toHaveLength(18);
    const text = elements.find((e): e is Extract<PrintElement, { type: 'text' }> => e.type === 'text');
    expect(text?.content).toBe('hi');
  });
});

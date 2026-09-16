import { DefaultReceiptPreset } from '../DefaultReceiptPreset';
import { applyReceiptPreset } from '../../applyPreset';

describe('DefaultReceiptPreset', () => {
  it('has a 58mm 203dpi config and no prefilled elements', () => {
    expect(DefaultReceiptPreset.config).toEqual({ width: 58, unit: 'mm', dpi: 203 });
    expect(DefaultReceiptPreset.build({})).toEqual([]);
  });

  it('applies to a resolvable blank receipt', () => {
    const doc = applyReceiptPreset(DefaultReceiptPreset, {}).resolve();
    expect(doc.elements).toEqual([]);
    expect(doc.widthDots).toBeGreaterThan(0);
  });
});

import { DefaultReceiptTemplate } from '../DefaultReceiptTemplate';
import { applyReceiptTemplate } from '../../applyTemplate';

describe('DefaultReceiptTemplate', () => {
  it('has a 58mm 203dpi config and no prefilled elements', () => {
    expect(DefaultReceiptTemplate.config).toEqual({ width: 58, unit: 'mm', dpi: 203 });
    expect(DefaultReceiptTemplate.elements).toEqual([]);
  });

  it('applies to a resolvable blank receipt', () => {
    const doc = applyReceiptTemplate(DefaultReceiptTemplate).resolve();
    expect(doc.elements).toEqual([]);
    expect(doc.widthDots).toBeGreaterThan(0);
  });
});

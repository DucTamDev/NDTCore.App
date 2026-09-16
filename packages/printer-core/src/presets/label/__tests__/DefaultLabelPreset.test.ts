import { DefaultLabelPreset } from '../DefaultLabelPreset';
import { applyLabelPreset } from '../../applyPreset';

describe('DefaultLabelPreset', () => {
  it('has a 40x30mm 203dpi config and no prefilled elements', () => {
    expect(DefaultLabelPreset.config).toEqual({ width: 40, height: 30, unit: 'mm', dpi: 203 });
    expect(DefaultLabelPreset.build({})).toEqual([]);
  });

  it('applies to a resolvable blank label', () => {
    const doc = applyLabelPreset(DefaultLabelPreset, {}).resolve();
    expect(doc.elements).toEqual([]);
    expect(doc.widthDots).toBeGreaterThan(0);
  });
});

import {
  DefaultLabelPreset,
  ProductLabelPreset,
  ToppingLabelPreset,
  DefaultReceiptPreset,
  StandardReceiptPreset,
  CompactReceiptPreset,
  applyLabelPreset,
  applyReceiptPreset,
} from '../../index';

describe('presets barrel', () => {
  it('re-exports all 6 presets and both apply helpers through the package root', () => {
    expect(DefaultLabelPreset).toBeDefined();
    expect(ProductLabelPreset).toBeDefined();
    expect(ToppingLabelPreset).toBeDefined();
    expect(DefaultReceiptPreset).toBeDefined();
    expect(StandardReceiptPreset).toBeDefined();
    expect(CompactReceiptPreset).toBeDefined();
    expect(typeof applyLabelPreset).toBe('function');
    expect(typeof applyReceiptPreset).toBe('function');
  });
});

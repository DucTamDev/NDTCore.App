import { DefaultLabelPreset, DefaultReceiptPreset, applyLabelPreset, applyReceiptPreset } from '../../index';

describe('presets barrel', () => {
  it('re-exports both default presets and both apply helpers through the package root', () => {
    expect(DefaultLabelPreset).toBeDefined();
    expect(DefaultReceiptPreset).toBeDefined();
    expect(typeof applyLabelPreset).toBe('function');
    expect(typeof applyReceiptPreset).toBe('function');
  });
});

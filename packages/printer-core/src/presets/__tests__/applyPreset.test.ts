import { applyLabelPreset, applyReceiptPreset } from '../applyPreset';
import type { LabelPreset } from '../LabelPreset';
import type { ReceiptPreset } from '../ReceiptPreset';

describe('applyLabelPreset', () => {
  const preset: LabelPreset = {
    config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
    elements: [{ type: 'text', content: 'Hello', options: {} }],
  };

  it('builds a LabelBuilder with the preset config and starting elements', () => {
    const doc = applyLabelPreset(preset).resolve();
    expect(doc.elements).toEqual([{ type: 'text', content: 'Hello', options: {} }]);
    expect(doc.dpi).toBe(203);
  });

  it('applies overrides on top of the preset config', () => {
    const doc = applyLabelPreset(preset, { dpi: 300 }).resolve();
    expect(doc.dpi).toBe(300);
  });

  it('returns a builder that can be extended with further chain calls', () => {
    const doc = applyLabelPreset(preset).text('extra', {}).resolve();
    expect(doc.elements).toHaveLength(2);
  });
});

describe('applyReceiptPreset', () => {
  const preset: ReceiptPreset = {
    config: { width: 58, unit: 'mm', dpi: 203 },
    elements: [{ type: 'text', content: 'Hi', options: {} }],
  };

  it('builds a ReceiptBuilder with the preset config and starting elements', () => {
    const doc = applyReceiptPreset(preset).resolve();
    expect(doc.elements).toEqual([{ type: 'text', content: 'Hi', options: {} }]);
    expect(doc.dpi).toBe(203);
  });

  it('applies overrides on top of the preset config', () => {
    const doc = applyReceiptPreset(preset, { dpi: 300 }).resolve();
    expect(doc.dpi).toBe(300);
  });

  it('returns a builder that can be extended with further chain calls', () => {
    const doc = applyReceiptPreset(preset).text('extra', {}).resolve();
    expect(doc.elements).toHaveLength(2);
  });
});

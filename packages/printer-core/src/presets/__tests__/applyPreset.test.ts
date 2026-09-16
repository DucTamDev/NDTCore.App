import { applyLabelPreset, applyReceiptPreset } from '../applyPreset';
import type { LabelPreset } from '../LabelPreset';
import type { ReceiptPreset } from '../ReceiptPreset';

describe('applyLabelPreset', () => {
  const preset: LabelPreset<{ name: string }> = {
    config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
    build: (vars) => [{ type: 'text', content: vars.name, options: {} }],
  };

  it('builds a LabelBuilder with the preset config and built elements', () => {
    const doc = applyLabelPreset(preset, { name: 'Hello' }).resolve();
    expect(doc.elements).toEqual([{ type: 'text', content: 'Hello', options: {} }]);
    expect(doc.dpi).toBe(203);
  });

  it('applies overrides on top of the preset config', () => {
    const doc = applyLabelPreset(preset, { name: 'Hello' }, { dpi: 300 }).resolve();
    expect(doc.dpi).toBe(300);
  });

  it('returns a builder that can be extended with further chain calls', () => {
    const doc = applyLabelPreset(preset, { name: 'Hello' })
      .text('extra', {})
      .resolve();
    expect(doc.elements).toHaveLength(2);
  });
});

describe('applyReceiptPreset', () => {
  const preset: ReceiptPreset<{ line: string }> = {
    config: { width: 58, unit: 'mm', dpi: 203 },
    build: (vars) => [{ type: 'text', content: vars.line, options: {} }],
  };

  it('builds a ReceiptBuilder with the preset config and built elements', () => {
    const doc = applyReceiptPreset(preset, { line: 'Hi' }).resolve();
    expect(doc.elements).toEqual([{ type: 'text', content: 'Hi', options: {} }]);
  });
});

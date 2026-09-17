import { applyLabelTemplate, applyReceiptTemplate } from '../applyTemplate';
import type { LabelTemplate, ReceiptTemplate } from '../PrintTemplate';
import { PrintTemplateType } from '../PrintTemplateType';

describe('applyLabelTemplate', () => {
  const template: LabelTemplate = {
    id: 't1',
    name: 'Test label',
    type: PrintTemplateType.Label,
    config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
    elements: [{ type: 'text', content: 'Hello', options: {} }],
  };

  it('builds a LabelBuilder with the template config and starting elements', () => {
    const doc = applyLabelTemplate(template).resolve();
    expect(doc.elements).toEqual([{ type: 'text', content: 'Hello', options: {} }]);
    expect(doc.dpi).toBe(203);
  });

  it('applies overrides on top of the template config', () => {
    const doc = applyLabelTemplate(template, { dpi: 300 }).resolve();
    expect(doc.dpi).toBe(300);
  });

  it('returns a builder that can be extended with further chain calls', () => {
    const doc = applyLabelTemplate(template).text('extra', {}).resolve();
    expect(doc.elements).toHaveLength(2);
  });
});

describe('applyReceiptTemplate', () => {
  const template: ReceiptTemplate = {
    id: 't2',
    name: 'Test receipt',
    type: PrintTemplateType.Receipt,
    config: { width: 58, unit: 'mm', dpi: 203 },
    elements: [{ type: 'text', content: 'Hi', options: {} }],
  };

  it('builds a ReceiptBuilder with the template config and starting elements', () => {
    const doc = applyReceiptTemplate(template).resolve();
    expect(doc.elements).toEqual([{ type: 'text', content: 'Hi', options: {} }]);
    expect(doc.dpi).toBe(203);
  });

  it('applies overrides on top of the template config', () => {
    const doc = applyReceiptTemplate(template, { dpi: 300 }).resolve();
    expect(doc.dpi).toBe(300);
  });

  it('returns a builder that can be extended with further chain calls', () => {
    const doc = applyReceiptTemplate(template).text('extra', {}).resolve();
    expect(doc.elements).toHaveLength(2);
  });
});

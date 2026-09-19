import { PrintTemplateType } from '../PrintTemplateType';
import type { LabelTemplate, ReceiptTemplate, PrintTemplate } from '../PrintTemplate';

describe('PrintTemplate', () => {
  it('LabelTemplate requires heightDots in config', () => {
    const label: LabelTemplate = {
      id: 't1',
      version: 1,
      type: PrintTemplateType.Label,
      config: { widthDots: 400, heightDots: 240, dpi: 203 },
      root: { type: 'text', id: 'r1', text: 'hi' },
    };
    expect(label.config.heightDots).toBe(240);
  });

  it('ReceiptTemplate omits heightDots from config', () => {
    const receipt: ReceiptTemplate = {
      id: 't2',
      version: 1,
      type: PrintTemplateType.Receipt,
      config: { widthDots: 576, dpi: 203 },
      root: { type: 'text', id: 'r1', text: 'hi' },
    };
    // @ts-expect-error ReceiptTemplate.config omits heightDots
    receipt.config.heightDots;
    expect(receipt.config.widthDots).toBe(576);
  });

  it('PrintTemplate narrows on `type`', () => {
    const templates: PrintTemplate[] = [
      { id: 't1', version: 1, type: PrintTemplateType.Label, config: { widthDots: 1, heightDots: 1, dpi: 1 }, root: { type: 'line', id: 'l1' } },
      { id: 't2', version: 1, type: PrintTemplateType.Receipt, config: { widthDots: 1, dpi: 1 }, root: { type: 'line', id: 'l1' } },
    ];
    for (const t of templates) {
      if (t.type === PrintTemplateType.Label) expect(t.config.heightDots).toBeDefined();
    }
  });
});

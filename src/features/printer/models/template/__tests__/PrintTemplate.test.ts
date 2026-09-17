import { PrintTemplateType, type PrintTemplate } from '../PrintTemplate';

describe('PrintTemplate', () => {
  const label: PrintTemplate = {
    id: '1',
    name: 'Nhãn sản phẩm',
    type: PrintTemplateType.Label,
    config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
    elements: [],
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
  };

  const receipt: PrintTemplate = {
    id: '2',
    name: 'Hóa đơn',
    type: PrintTemplateType.Receipt,
    config: { width: 58, unit: 'mm', dpi: 203 },
    elements: [],
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
  };

  it('narrows to LabelPrintTemplate when type is Label, exposing config.height', () => {
    if (label.type === PrintTemplateType.Label) {
      expect(label.config.height).toBe(30);
    } else {
      throw new Error('expected label.type to narrow to Label');
    }
  });

  it('narrows to ReceiptPrintTemplate when type is Receipt', () => {
    if (receipt.type === PrintTemplateType.Receipt) {
      // @ts-expect-error -- ReceiptPrintTemplate's config omits height entirely
      expect(receipt.config.height).toBeUndefined();
    } else {
      throw new Error('expected receipt.type to narrow to Receipt');
    }
  });
});

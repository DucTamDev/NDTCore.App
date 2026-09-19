import { receiptTemplate } from '../ReceiptTemplateBuilder';
import { column } from '../ContainerBuilder';
import { text } from '../TextBuilder';
import { PrintTemplateType } from '../../PrintTemplateType';

describe('receiptTemplate()', () => {
  it('builds a ReceiptTemplate whose config has no heightDots', () => {
    const t = receiptTemplate()
      .size({ widthDots: 576, dpi: 203 })
      .root(column().children(text.literal('MY SHOP')))
      .build();

    expect(t.type).toBe(PrintTemplateType.Receipt);
    expect(t.config).toEqual({ widthDots: 576, dpi: 203 });
  });

  it('throws when .size(...) is missing', () => {
    expect(() => receiptTemplate().root(text.literal('X')).build()).toThrow(/requires \.size/);
  });
});

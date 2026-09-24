import { barcode, mm } from '..';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('barcode', () => {
  it('symbology bắt buộc, readable + chiều cao vạch tuỳ chọn', () => {
    const node = barcode([{ var: 'orderCode' }], 'code128')
      .readable(true)
      .barHeight(mm(8))
      .build({ idGenerator: new TemplateNodeIdGenerator() });

    expect(node).toEqual({
      type: 'barcode',
      id: 'barcode-1',
      content: [{ var: 'orderCode' }],
      symbology: 'code128',
      readable: true,
      barHeight: mm(8),
    });
  });
});

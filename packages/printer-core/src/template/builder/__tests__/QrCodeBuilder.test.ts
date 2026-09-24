import { mm, qrcode } from '..';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('qrcode', () => {
  it('mức sửa lỗi + cỡ module', () => {
    const node = qrcode('https://ndt.vn')
      .errorCorrection('M')
      .moduleSize(mm(0.5))
      .build({ idGenerator: new TemplateNodeIdGenerator() });

    expect(node).toEqual({
      type: 'qrcode',
      id: 'qrcode-1',
      content: [{ text: 'https://ndt.vn' }],
      errorCorrection: 'M',
      moduleSize: mm(0.5),
    });
  });
});

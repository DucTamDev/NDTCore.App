import { qrcode } from '../QrCodeBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('QrCodeBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('qrcode.literal(value) builds a QrCodeNode with `content`', () => {
    const node = qrcode.literal('https://example.com').build(context);
    expect(node).toMatchObject({ type: 'qrcode', content: 'https://example.com' });
  });

  it('qrcode.binding(path) sets `binding`', () => {
    const node = qrcode.binding('order.qr').build(context);
    expect(node.binding).toBe('order.qr');
  });

  it('errorCorrection(level) sets errorCorrection', () => {
    const node = qrcode.literal('X').errorCorrection('M').build(context);
    expect(node.errorCorrection).toBe('M');
  });
});

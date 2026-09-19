import { barcode } from '../BarcodeBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('BarcodeBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('barcode.literal(value).symbology(...) builds a BarcodeNode with `content`', () => {
    const node = barcode.literal('ABC123').symbology('code128').build(context);
    expect(node).toMatchObject({ type: 'barcode', content: 'ABC123', symbology: 'code128' });
  });

  it('barcode.binding(path) sets `binding`, not `content`', () => {
    const node = barcode.binding('order.code').symbology('code128').build(context);
    expect(node.binding).toBe('order.code');
    expect(node.content).toBeUndefined();
  });

  it('readable(true) sets readable', () => {
    const node = barcode.literal('X').symbology('code128').readable(true).build(context);
    expect(node.readable).toBe(true);
  });
});

import { bindElements } from '../bindElements';
import type { PrintElement } from '../../builder';

describe('bindElements', () => {
  it('substitutes {{key}} in a text element with the matching data value', () => {
    const elements: PrintElement[] = [{ type: 'text', content: 'Tên: {{productName}}', options: { x: 8, y: 8 } }];
    const bound = bindElements(elements, { productName: 'Trà sữa trân châu' });
    expect(bound).toEqual([{ type: 'text', content: 'Tên: Trà sữa trân châu', options: { x: 8, y: 8 } }]);
  });

  it('substitutes multiple different keys across multiple elements', () => {
    const elements: PrintElement[] = [
      { type: 'text', content: '{{productName}}', options: {} },
      { type: 'text', content: 'Giá: {{price}}đ', options: {} },
    ];
    const bound = bindElements(elements, { productName: 'Trà đào', price: 20000 });
    expect(bound).toEqual([
      { type: 'text', content: 'Trà đào', options: {} },
      { type: 'text', content: 'Giá: 20000đ', options: {} },
    ]);
  });

  it('substitutes {{key}} inside a barcode element\'s content', () => {
    const elements: PrintElement[] = [{ type: 'barcode', options: { symbology: 'code128', content: '{{sku}}' } }];
    const bound = bindElements(elements, { sku: '8931234567890' });
    expect(bound).toEqual([{ type: 'barcode', options: { symbology: 'code128', content: '8931234567890' } }]);
  });

  it('substitutes {{key}} inside a qrcode element\'s content', () => {
    const elements: PrintElement[] = [{ type: 'qrcode', options: { content: '{{url}}' } }];
    const bound = bindElements(elements, { url: 'https://example.com/8931234567890' });
    expect(bound).toEqual([{ type: 'qrcode', options: { content: 'https://example.com/8931234567890' } }]);
  });

  it('substitutes {{key}} inside a string raw element, leaves a Uint8Array raw element untouched', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const elements: PrintElement[] = [
      { type: 'raw', content: 'CMD {{code}}' },
      { type: 'raw', content: bytes },
    ];
    const bound = bindElements(elements, { code: 'X1' });
    expect(bound).toEqual([{ type: 'raw', content: 'CMD X1' }, { type: 'raw', content: bytes }]);
  });

  it('leaves an unmatched {{key}} placeholder untouched when data has no matching field', () => {
    const elements: PrintElement[] = [{ type: 'text', content: 'Hi {{unknown}}', options: {} }];
    const bound = bindElements(elements, { productName: 'X' });
    expect(bound).toEqual([{ type: 'text', content: 'Hi {{unknown}}', options: {} }]);
  });

  it('leaves elements with no bindable string content completely unchanged', () => {
    const elements: PrintElement[] = [
      { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'pageBreak' },
    ];
    const bound = bindElements(elements, { productName: 'X' });
    expect(bound).toEqual(elements);
  });

  it('does not mutate the original elements array', () => {
    const original: PrintElement[] = [{ type: 'text', content: '{{name}}', options: {} }];
    const snapshot = JSON.parse(JSON.stringify(original));
    bindElements(original, { name: 'Y' });
    expect(original).toEqual(snapshot);
  });
});

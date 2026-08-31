import type { PrintDocument, PrintElement } from '../PrintDocument';

describe('print document types', () => {
  it('accepts a document mixing every element kind', () => {
    const elements: PrintElement[] = [
      { type: 'text', content: 'NDTCore POS', x: 0, y: 0 },
      { type: 'line', x: 0, y: 10 },
      { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      { type: 'image', data: 'base64...', x: 0, y: 40 },
      { type: 'barcode', content: '123456', x: 0, y: 60 },
      { type: 'qrCode', content: 'https://ndtcore.pos/order/1', x: 0, y: 80 },
      { type: 'row', left: 'Mã đơn', right: '#001', x: 0, y: 100 },
    ];
    const document: PrintDocument = { elements };
    expect(document.elements).toHaveLength(7);
  });
});

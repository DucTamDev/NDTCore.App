import { ProductLabelPreset } from '../ProductLabelPreset';

describe('ProductLabelPreset', () => {
  it('has the shared 40x30mm 203dpi label config', () => {
    expect(ProductLabelPreset.config).toEqual({ width: 40, height: 30, unit: 'mm', dpi: 203 });
  });

  it('builds name, size, price, barcode, and note elements from full vars', () => {
    const elements = ProductLabelPreset.build({
      productName: 'Trà sữa trân châu',
      size: 'L',
      price: 25000,
      sku: '8931234567890',
      note: 'Không đường',
    });

    expect(elements).toEqual([
      { type: 'text', content: 'Trà sữa trân châu', options: { x: 8, y: 8, bold: true, size: 2 } },
      { type: 'text', content: 'L', options: { x: 8, y: 40 } },
      { type: 'text', content: '25.000đ', options: { x: 8, y: 65, bold: true, size: 2 } },
      {
        type: 'barcode',
        options: { x: 8, y: 100, symbology: 'code128', content: '8931234567890', height: 60, readable: true },
      },
      { type: 'text', content: 'Không đường', options: { x: 8, y: 170 } },
    ]);
  });

  it('omits the size and note elements when not provided', () => {
    const elements = ProductLabelPreset.build({ productName: 'Trà sữa', price: 20000, sku: '111' });
    expect(elements.map((e) => e.type)).toEqual(['text', 'text', 'barcode']);
  });

  it('formats price with thousands separators', () => {
    const elements = ProductLabelPreset.build({ productName: 'X', price: 1234567, sku: '1' });
    const priceElement = elements.find((e) => e.type === 'text' && e.content.endsWith('đ'));
    expect(priceElement).toMatchObject({ content: '1.234.567đ' });
  });
});

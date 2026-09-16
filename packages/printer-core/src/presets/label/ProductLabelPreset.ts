import type { PrintElement } from '../../builder';
import type { LabelPreset } from '../LabelPreset';

export interface ProductLabelVars {
  productName: string;
  size?: string;
  price: number;
  sku: string;
  note?: string;
}

/** `12345` -> `"12.345đ"` — deterministic thousands grouping, no locale/ICU dependency. */
function formatCurrency(value: number): string {
  const grouped = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped}đ`;
}

/**
 * 40x30mm product label: name, optional size, price, SKU barcode, optional
 * note. Dot positions are a reasonable starting layout, not yet verified
 * against real hardware — refine after visual testing.
 */
export const ProductLabelPreset: LabelPreset<ProductLabelVars> = {
  config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
  build: (vars) => {
    const elements: PrintElement[] = [
      { type: 'text', content: vars.productName, options: { x: 8, y: 8, bold: true, size: 2 } },
    ];
    if (vars.size) elements.push({ type: 'text', content: vars.size, options: { x: 8, y: 40 } });
    elements.push({ type: 'text', content: formatCurrency(vars.price), options: { x: 8, y: 65, bold: true, size: 2 } });
    elements.push({
      type: 'barcode',
      options: { x: 8, y: 100, symbology: 'code128', content: vars.sku, height: 60, readable: true },
    });
    if (vars.note) elements.push({ type: 'text', content: vars.note, options: { x: 8, y: 170 } });
    return elements;
  },
};

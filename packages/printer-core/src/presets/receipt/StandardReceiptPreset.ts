import type { PrintElement } from '../../builder';
import type { ReceiptColumn } from '../../receipt';
import type { ReceiptPreset } from '../ReceiptPreset';

export interface StandardReceiptItem {
  name: string;
  qty: number;
  price: number;
}

export interface StandardReceiptVars {
  storeName: string;
  orderNumber: string;
  items: StandardReceiptItem[];
  total: number;
  cashier?: string;
  timestamp: string;
}

const DIVIDER = '-'.repeat(32);
const COLUMNS: ReceiptColumn[] = [{ width: 16 }, { width: 6, align: 'center' }, { width: 10, align: 'right' }];

/** `12345` -> `"12.345đ"` — deterministic thousands grouping, no locale/ICU dependency. Exported for `CompactReceiptPreset`. */
export function formatCurrency(value: number): string {
  const grouped = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped}đ`;
}

function itemRows(items: StandardReceiptItem[]): string[][] {
  return items.map((i) => [i.name, String(i.qty), formatCurrency(i.price)]);
}

/**
 * 58mm continuous receipt with full order detail: store name header, order
 * number/timestamp, itemized table, total, optional cashier, thank-you
 * line, then cut.
 */
export const StandardReceiptPreset: ReceiptPreset<StandardReceiptVars> = {
  config: { width: 58, unit: 'mm', dpi: 203 },
  build: (vars) => {
    const elements: PrintElement[] = [
      { type: 'text', content: vars.storeName, options: { align: 'center', bold: true, size: 2 } },
      { type: 'text', content: DIVIDER, options: {} },
      { type: 'text', content: `Mã đơn: ${vars.orderNumber}`, options: {} },
      { type: 'text', content: `Thời gian: ${vars.timestamp}`, options: {} },
      { type: 'text', content: DIVIDER, options: {} },
      { type: 'table', options: { columns: COLUMNS, rows: itemRows(vars.items) } },
      { type: 'text', content: DIVIDER, options: {} },
      { type: 'text', content: `Tổng cộng: ${formatCurrency(vars.total)}`, options: { bold: true, align: 'right' } },
    ];
    if (vars.cashier) elements.push({ type: 'text', content: `Thu ngân: ${vars.cashier}`, options: {} });
    elements.push({ type: 'text', content: 'Cảm ơn quý khách!', options: { align: 'center' } });
    elements.push({ type: 'cut', options: {} });
    return elements;
  },
};

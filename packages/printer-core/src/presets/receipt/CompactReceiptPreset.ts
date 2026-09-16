import type { ReceiptColumn } from '../../receipt';
import type { ReceiptPreset } from '../ReceiptPreset';
import { formatCurrency, type StandardReceiptItem, type StandardReceiptVars } from './StandardReceiptPreset';

const COLUMNS: ReceiptColumn[] = [{ width: 16 }, { width: 6, align: 'center' }, { width: 10, align: 'right' }];

function itemRows(items: StandardReceiptItem[]): string[][] {
  return items.map((i) => [i.name, String(i.qty), formatCurrency(i.price)]);
}

/**
 * 58mm continuous receipt, minimal — order number, itemized table, total,
 * cut. Reuses `StandardReceiptVars` (same data shape as `StandardReceiptPreset`)
 * but omits the store header, cashier line, and thank-you line to minimize
 * paper length.
 */
export const CompactReceiptPreset: ReceiptPreset<StandardReceiptVars> = {
  config: { width: 58, unit: 'mm', dpi: 203 },
  build: (vars) => [
    { type: 'text', content: `Mã đơn: ${vars.orderNumber}`, options: {} },
    { type: 'table', options: { columns: COLUMNS, rows: itemRows(vars.items) } },
    { type: 'text', content: `Tổng cộng: ${formatCurrency(vars.total)}`, options: { bold: true, align: 'right' } },
    { type: 'cut', options: {} },
  ],
};

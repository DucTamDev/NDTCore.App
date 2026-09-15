import { ReceiptColumn } from './ReceiptColumn';
import { formatRow } from './ReceiptFormatter';

/**
 * Stateful wrapper for column definitions and total width,
 * to avoid re-passing them across multiple row formatting calls
 */
export interface ReceiptLayout {
  columns: ReceiptColumn[];
  totalWidth: number;
}

export function layoutToRow(layout: ReceiptLayout, values: string[]): string {
  return formatRow(layout.columns, values, layout.totalWidth);
}

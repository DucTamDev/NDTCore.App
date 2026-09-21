import { TableColumn } from '../formatting/TableColumn';
import { formatRow } from '../formatting/RowFormatter';

/**
 * Stateful wrapper for column definitions and total width,
 * to avoid re-passing them across multiple row formatting calls
 */
export interface ReceiptLayout {
  columns: TableColumn[];
  totalWidth: number;
}

export function layoutToRow(layout: ReceiptLayout, values: string[]): string {
  return formatRow(layout.columns, values, layout.totalWidth);
}

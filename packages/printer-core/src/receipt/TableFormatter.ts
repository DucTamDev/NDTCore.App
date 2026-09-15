import { ReceiptColumn } from './ReceiptColumn';
import { formatRow } from './ReceiptFormatter';

/**
 * Format a table with headers and rows
 */
export function formatTable(columns: ReceiptColumn[], rows: string[][], totalWidth: number): string[] {
  return rows.map((row) => formatRow(columns, row, totalWidth));
}

import { ReceiptColumn } from './ReceiptColumn';
import { formatRow } from './ReceiptFormatter';

export function formatTable(columns: ReceiptColumn[], rows: string[][], totalWidth: number): string[] {
  return rows.map((row) => formatRow(columns, row, totalWidth));
}

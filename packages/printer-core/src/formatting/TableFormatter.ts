import { TableColumn } from './TableColumn';
import { formatRow } from './RowFormatter';

export function formatTable(columns: TableColumn[], rows: string[][], totalWidth: number): string[] {
  return rows.map((row) => formatRow(columns, row, totalWidth));
}

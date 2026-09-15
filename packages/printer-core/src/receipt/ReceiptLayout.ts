import { ReceiptColumn } from './ReceiptColumn';
import { formatRow } from './ReceiptFormatter';

/**
 * A stateful receipt layout: columns and total width
 * Allows callers to build up a receipt across multiple calls without re-passing both.
 */
export interface ReceiptLayout {
  /**
   * Column definitions for the layout
   */
  columns: ReceiptColumn[];
  /**
   * Total width in characters
   */
  totalWidth: number;
}

/**
 * Format a single row of values using the layout's columns and total width
 */
export function layoutToRow(layout: ReceiptLayout, values: string[]): string {
  return formatRow(layout.columns, values, layout.totalWidth);
}

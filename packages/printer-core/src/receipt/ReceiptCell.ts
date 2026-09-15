import { ReceiptColumn } from './ReceiptColumn';

/**
 * A receipt table cell: a string value with its column definition
 */
export interface ReceiptCell {
  /**
   * The cell's text value
   */
  value: string;
  /**
   * The column this cell renders under
   */
  column: ReceiptColumn;
}

import type { Point } from '../../../types';
import type { TableColumn } from '../../../formatting';

/**
 * Options for a table placed as a positioned document element — distinct
 * from receipt-mode `formatTable()` (see `../../../formatting/TableFormatter`),
 * which formats rows into text lines rather than describing a layout box.
 */
export interface TableOptions extends Point {
  columns: TableColumn[];
  rows: string[][];
}

/** A table placed as a positioned document element. */
export interface TableElement {
  type: 'table';
  options: TableOptions;
}

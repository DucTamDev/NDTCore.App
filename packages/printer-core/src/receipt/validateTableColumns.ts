import type { ReceiptColumn } from './ReceiptColumn';

/**
 * Validates that every column has a positive width before it reaches
 * `formatTable()`/`formatRow()`.
 *
 * `formatRow()`'s auto-width logic treats any column with `width <= 0` as
 * "auto-size this column", computing `autoWidth = (totalWidth -
 * assignedWidth) / autoCount`. All 3 callers of `formatTable()` in this
 * package (`EscPosCompiler`, `TscCompiler`, `TscPreviewRenderer`) derive
 * `totalWidth` as the sum of the columns' own `width` values, which makes
 * `totalWidth - assignedWidth` exactly equal to the auto columns' own
 * (non-positive) width — i.e. always zero for a `width: 0` column. That
 * column then renders as an empty string, silently dropping real cell
 * content instead of erroring. Auto-sizing isn't supported yet, so this
 * rejects it explicitly instead of letting it fail silently.
 */
export function validateTableColumns(columns: ReceiptColumn[]): void {
  for (const column of columns) {
    if (column.width <= 0) {
      throw new Error(
        'TableElement requires every column to specify a positive width — auto-sizing columns (width <= 0) are not yet supported',
      );
    }
  }
}

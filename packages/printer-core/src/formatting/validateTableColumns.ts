import type { TableColumn } from './TableColumn';

/**
 * Bắt buộc mọi cột có độ rộng dương trước khi vào `formatTable()`/`formatRow()`. `formatRow()` coi `width <= 0` là
 * cột tự co giãn, nhưng mọi nơi gọi đều tính tổng độ rộng từ chính các cột nên cột đó luôn rộng 0 và mất nội dung
 * âm thầm — báo lỗi rõ thay vì in thiếu.
 */
export function validateTableColumns(columns: TableColumn[]): void {
  for (const column of columns) {
    if (column.width <= 0) {
      throw new Error(
        'TableElement requires every column to specify a positive width — auto-sizing columns (width <= 0) are not yet supported',
      );
    }
  }
}

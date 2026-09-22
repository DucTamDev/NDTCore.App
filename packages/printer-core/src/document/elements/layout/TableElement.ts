import type { Point } from '../../../types';
import type { TableColumn } from '../../../formatting';

/**
 * Options cho 1 bảng đặt như 1 element document có vị trí cụ thể — khác với
 * `formatTable()` ở chế độ receipt (xem `../../../formatting/TableFormatter`),
 * vốn format các hàng thành dòng text thay vì mô tả 1 khung layout.
 */
export interface TableOptions extends Point {
  /** Định nghĩa cột (chiều rộng tính bằng dots, căn lề). */
  columns: TableColumn[];
  /** Dữ liệu các hàng — mỗi mảng con là giá trị các ô của 1 hàng, theo đúng thứ tự cột. */
  rows: string[][];
}

/** Một bảng đặt như 1 element document có vị trí cụ thể. */
export interface TableElement {
  type: 'table';
  options: TableOptions;
}

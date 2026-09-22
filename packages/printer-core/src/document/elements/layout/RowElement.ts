import type { Point } from '../../../types';

/** Options cho 1 container layout theo hàng ngang. */
export interface RowOptions extends Point {
  /** Khoảng cách giữa các phần tử con, tính bằng dots. */
  gap?: number;
}

/** Một container layout theo hàng ngang. */
export interface RowElement {
  type: 'row';
  options: RowOptions;
}

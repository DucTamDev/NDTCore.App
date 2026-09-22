import type { Point } from '../../../types';

/** Options cho 1 container layout theo cột dọc. */
export interface ColumnOptions extends Point {
  /** Khoảng cách giữa các phần tử con, tính bằng dots. */
  gap?: number;
}

/** Một container layout theo cột dọc. */
export interface ColumnElement {
  type: 'column';
  options: ColumnOptions;
}

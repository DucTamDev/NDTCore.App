import type { Point } from '../../types';

/** Options for a vertical column layout — net-new, no portakal equivalent. */
export interface ColumnOptions extends Point {
  /** Gap between children, in dots. */
  gap?: number;
}

/** A vertical column layout container. */
export interface ColumnElement {
  type: 'column';
  options: ColumnOptions;
}

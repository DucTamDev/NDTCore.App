import type { Point } from '../../types';

/** Options for a horizontal row layout — net-new, no portakal equivalent. */
export interface RowOptions extends Point {
  /** Gap between children, in dots. */
  gap?: number;
}

/** A horizontal row layout container. */
export interface RowElement {
  type: 'row';
  options: RowOptions;
}

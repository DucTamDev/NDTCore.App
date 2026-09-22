import type { Unit } from '../../../types';

/** Options cho 1 spacer kích thước cố định. */
export interface SpacerOptions {
  /** Kích thước spacer, theo đơn vị `unit`. */
  size: number;

  /** Đơn vị của `size`. */
  unit?: Unit;
}

/** Một spacer kích thước cố định. */
export interface SpacerElement {
  type: 'spacer';
  options: SpacerOptions;
}

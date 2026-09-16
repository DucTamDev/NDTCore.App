import type { Unit } from '../../types';

/** Options for a fixed-size spacer — net-new, no portakal equivalent. */
export interface SpacerOptions {
  size: number;
  unit?: Unit;
}

/** A fixed-size spacer. */
export interface SpacerElement {
  type: 'spacer';
  options: SpacerOptions;
}

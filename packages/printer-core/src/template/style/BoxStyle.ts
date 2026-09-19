import type { Dimension } from './Dimension';
import type { Insets } from './Insets';

export interface BoxStyle {
  readonly width?: Dimension;
  readonly height?: Dimension;
  readonly margin?: Insets;
  readonly padding?: Insets;
}

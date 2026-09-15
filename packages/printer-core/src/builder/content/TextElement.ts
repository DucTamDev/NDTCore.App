import type { Alignment, Rotation } from '../../types';

/** Options for a text element. */
export interface TextOptions {
  x?: number;
  y?: number;
  font?: string;
  size?: number;
  xScale?: number;
  yScale?: number;
  rotation?: Rotation;
  bold?: boolean;
  underline?: boolean;
  reverse?: boolean;
  align?: Alignment;
  maxWidth?: number;
  lineSpacing?: number;
}

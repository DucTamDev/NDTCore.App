import type { LineOptions } from './LineElement';

/**
 * A diagonal line — reuses `LineOptions` verbatim, since a diagonal is a
 * line whose endpoints differ on both axes, not a different parameter
 * shape. `PrintBuilder.line()` selects this variant vs. `LineElement` via
 * `isDiagonal()` below.
 */
export interface DiagonalElement {
  type: 'diagonal';
  options: LineOptions;
}

/** True when a line's endpoints differ on both axes, i.e. it isn't axis-aligned. */
export function isDiagonal(line: LineOptions & { x1: number; y1: number; x2: number; y2: number }): boolean {
  return line.x1 !== line.x2 && line.y1 !== line.y2;
}

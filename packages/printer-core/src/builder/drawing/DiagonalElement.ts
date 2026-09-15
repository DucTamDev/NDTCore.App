import type { LineOptions } from './LineElement';

/**
 * A diagonal line has no dedicated element type of its own — it's a
 * `LineOptions` whose endpoints differ on both axes. Compilers that need a
 * diagonal-specific command variant (e.g. ZPL/TSC-family) can use this
 * predicate to distinguish it from an axis-aligned line.
 */
export function isDiagonal(line: LineOptions & { x1: number; y1: number; x2: number; y2: number }): boolean {
  return line.x1 !== line.x2 && line.y1 !== line.y2;
}

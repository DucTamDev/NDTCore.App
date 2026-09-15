import type { LineOptions } from './LineElement';

/**
 * A diagonal line is its own dedicated `PrintElement` variant (`DiagonalElement`,
 * see `builder/PrintElement.ts`), reusing `LineOptions` verbatim since a
 * diagonal is just a line whose endpoints differ on both axes, not a
 * different parameter shape. `PrintBuilder.line()` uses this predicate to
 * decide which variant to push: a `DiagonalElement` when the endpoints
 * differ on both axes, or a `LineElement` when the line is axis-aligned.
 */
export function isDiagonal(line: LineOptions & { x1: number; y1: number; x2: number; y2: number }): boolean {
  return line.x1 !== line.x2 && line.y1 !== line.y2;
}

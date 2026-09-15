/** Options for a straight line element between two points. */
export interface LineOptions {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Stroke width in dots; printer default is 1 when omitted. */
  thickness?: number;
}

/** Options for a circle element — unlike box/line/ellipse, `x`/`y` here are the center, not a corner. */
export interface CircleOptions {
  x: number;
  y: number;
  diameter: number;
  /** Stroke width in dots; printer default is 1 when omitted. */
  thickness?: number;
}

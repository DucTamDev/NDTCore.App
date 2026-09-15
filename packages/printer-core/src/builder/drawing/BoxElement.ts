/** Options for a rectangle (box) element. */
export interface BoxOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stroke width in dots; printer default is 1 when omitted. */
  thickness?: number;
  /** Corner rounding radius, in dots — 0/omitted means square corners. */
  radius?: number;
}

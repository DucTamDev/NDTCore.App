/** Options for a reverse-print region (inverts black/white within the box). */
export interface ReverseOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A reverse-print region (inverts black/white within the box). */
export interface ReverseElement {
  type: 'reverse';
  options: ReverseOptions;
}

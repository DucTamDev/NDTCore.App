/** Options for an erase region (clears the box to white). */
export interface EraseOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An erase region (clears the box to white). */
export interface EraseElement {
  type: 'erase';
  options: EraseOptions;
}

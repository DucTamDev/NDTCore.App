/** Options cho 1 vùng reverse-print (đảo đen/trắng trong vùng đó). */
export interface ReverseOptions {
  /** Toạ độ X góc trên-trái, tính bằng dots. */
  x: number;

  /** Toạ độ Y góc trên-trái, tính bằng dots. */
  y: number;

  /** Chiều rộng vùng reverse, tính bằng dots. */
  width: number;

  /** Chiều cao vùng reverse, tính bằng dots. */
  height: number;
}

/** Một vùng reverse-print (đảo đen/trắng trong vùng đó). */
export interface ReverseElement {
  type: 'reverse';
  options: ReverseOptions;
}

/** Options cho 1 vùng erase (xoá vùng về màu trắng). */
export interface EraseOptions {
  /** Toạ độ X góc trên-trái, tính bằng dots. */
  x: number;
  /** Toạ độ Y góc trên-trái, tính bằng dots. */
  y: number;
  /** Chiều rộng vùng erase, tính bằng dots. */
  width: number;
  /** Chiều cao vùng erase, tính bằng dots. */
  height: number;
}

/** Một vùng erase (xoá vùng về màu trắng). */
export interface EraseElement {
  type: 'erase';
  options: EraseOptions;
}

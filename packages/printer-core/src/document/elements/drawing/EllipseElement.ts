/** Options cho 1 element hình ellipse. */
export interface EllipseOptions {
  /** Toạ độ X góc trên-trái của bounding box, tính bằng dots. */
  x: number;

  /** Toạ độ Y góc trên-trái của bounding box, tính bằng dots. */
  y: number;

  /** Chiều rộng bounding box, tính bằng dots. */
  width: number;

  /** Chiều cao bounding box, tính bằng dots. */
  height: number;

  /** Độ dày nét vẽ, tính bằng dots; máy in mặc định 1 khi bỏ trống. */
  thickness?: number;
}

/** Một hình ellipse viền. */
export interface EllipseElement {
  type: 'ellipse';
  options: EllipseOptions;
}

/** Options cho 1 element hình chữ nhật (box). */
export interface BoxOptions {
  /** Toạ độ X góc trên-trái, tính bằng dots. */
  x: number;

  /** Toạ độ Y góc trên-trái, tính bằng dots. */
  y: number;

  /** Chiều rộng box, tính bằng dots. */
  width: number;

  /** Chiều cao box, tính bằng dots. */
  height: number;

  /** Độ dày nét vẽ, tính bằng dots; máy in mặc định 1 khi bỏ trống. */
  thickness?: number;

  /** Bán kính bo góc, tính bằng dots — 0/bỏ trống nghĩa là góc vuông. */
  radius?: number;
}

/** Một hình chữ nhật (box) viền. */
export interface BoxElement {
  type: 'box';
  options: BoxOptions;
}

/** Options cho 1 element hình tròn — khác box/line/ellipse, `x`/`y` ở đây là tâm, không phải góc. */
export interface CircleOptions {
  /** Toạ độ X tâm, tính bằng dots. */
  x: number;
  /** Toạ độ Y tâm, tính bằng dots. */
  y: number;
  /** Đường kính, tính bằng dots. */
  diameter: number;
  /** Độ dày nét vẽ, tính bằng dots; máy in mặc định 1 khi bỏ trống. */
  thickness?: number;
}

/** Một hình tròn viền. */
export interface CircleElement {
  type: 'circle';
  options: CircleOptions;
}

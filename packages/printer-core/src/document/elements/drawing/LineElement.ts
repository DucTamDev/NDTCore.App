/** Options cho 1 đường thẳng nối giữa 2 điểm. */
export interface LineOptions {
  /** Toạ độ X điểm đầu, tính bằng dots. */
  x1: number;

  /** Toạ độ Y điểm đầu, tính bằng dots. */
  y1: number;

  /** Toạ độ X điểm cuối, tính bằng dots. */
  x2: number;

  /** Toạ độ Y điểm cuối, tính bằng dots. */
  y2: number;

  /** Độ dày nét vẽ, tính bằng dots; máy in mặc định 1 khi bỏ trống. */
  thickness?: number;
}

/** Một đường thẳng theo trục (axis-aligned) — xem `DiagonalElement` cho trường hợp không theo trục. */
export interface LineElement {
  type: 'line';
  options: LineOptions;
}

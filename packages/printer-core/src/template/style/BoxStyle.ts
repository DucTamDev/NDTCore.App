import type { Dimension } from './Dimension';
import type { Insets } from './Insets';

/** Style hộp dùng chung cho mọi node. */
export interface BoxStyle {
  /** Chiều rộng; bỏ trống là `auto`. Với `LineNode`, `fixed` quyết định độ dài nét. */
  readonly width?: Dimension;

  /** Chiều cao; bỏ trống là `auto`. */
  readonly height?: Dimension;

  /** Khoảng cách bên ngoài hộp. */
  readonly margin?: Insets;

  /** Khoảng cách bên trong hộp, giữa viền và nội dung. */
  readonly padding?: Insets;
}

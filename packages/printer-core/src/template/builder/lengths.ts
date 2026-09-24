import type { Insets } from '../style/Insets';
import type { Length } from '../style/Length';

/** Độ dài tính bằng milimét. */
export function mm(value: number): Length {
  return { value, unit: 'mm' };
}

/** Độ dài tính bằng point (1/72 inch). */
export function pt(value: number): Length {
  return { value, unit: 'pt' };
}

/** Độ dài tính bằng pixel chuẩn CSS (1/96 inch). */
export function px(value: number): Length {
  return { value, unit: 'px' };
}

/**
 * Khoảng cách 4 cạnh theo quy ước CSS: `insets(a)` 4 cạnh bằng nhau, `insets(a, b)` trên-dưới `a` và
 * trái-phải `b`, `insets(a, b, c)` trên `a` trái-phải `b` dưới `c`, `insets(a, b, c, d)` theo chiều kim đồng hồ.
 */
export function insets(
  top: Length,
  right: Length = top,
  bottom: Length = top,
  left: Length = right,
): Insets {
  return { top, right, bottom, left };
}

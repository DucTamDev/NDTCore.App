import type { Length } from './Length';

/** Khoảng cách 4 cạnh, dùng cho `margin`/`padding`. */
export interface Insets {
  /** Khoảng cách cạnh trên. */
  readonly top: Length;

  /** Khoảng cách cạnh phải. */
  readonly right: Length;

  /** Khoảng cách cạnh dưới. */
  readonly bottom: Length;

  /** Khoảng cách cạnh trái. */
  readonly left: Length;
}

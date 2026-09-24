import type { BoxStyle } from './BoxStyle';
import type { Length } from './Length';

/** Style của container: hướng xếp và khoảng cách giữa các node con. */
export interface LayoutStyle extends BoxStyle {
  /** Hướng xếp node con; mặc định `column`. */
  readonly direction?: 'row' | 'column';

  /** Khoảng cách giữa 2 node con liền kề; mặc định 0. */
  readonly gap?: Length;

  /** Phân bố node con theo trục chính; mặc định `start`. */
  readonly justifyContent?: 'start' | 'center' | 'end' | 'space-between';

  /** Căn node con theo trục phụ; mặc định `start`. */
  readonly alignItems?: 'start' | 'center' | 'end';
}

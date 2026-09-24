import type { Length } from './Length';

/** Kích thước cố định đúng bằng `value`. */
export interface FixedDimension {
  readonly type: 'fixed';

  /** Kích thước cố định. */
  readonly value: Length;
}

/** Chiếm hết phần còn trống của container cha. */
export interface FillDimension {
  readonly type: 'fill';
}

/** Co theo nội dung. */
export interface AutoDimension {
  readonly type: 'auto';
}

/** Cách xác định chiều rộng/cao của 1 node. */
export type Dimension = FixedDimension | FillDimension | AutoDimension;

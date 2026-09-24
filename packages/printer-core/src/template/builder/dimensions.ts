import type { AutoDimension, FillDimension, FixedDimension } from '../style/Dimension';
import type { Length } from '../style/Length';

/** Kích thước cố định. */
export function fixed(value: Length): FixedDimension {
  return { type: 'fixed', value };
}

/** Chiếm hết phần còn trống của container cha. */
export function fill(): FillDimension {
  return { type: 'fill' };
}

/** Co theo nội dung. */
export function auto(): AutoDimension {
  return { type: 'auto' };
}

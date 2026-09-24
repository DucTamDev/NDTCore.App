import type { Condition } from '../content/Condition';

/** Field chung của mọi node. */
export interface TemplateNodeBase {
  /** Mã node, duy nhất trong template; dùng để báo lỗi đúng chỗ. */
  readonly id: string;

  /** Điều kiện hiển thị; bỏ trống là luôn hiện. */
  readonly visibleWhen?: Condition;
}

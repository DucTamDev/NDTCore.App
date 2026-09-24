/** Giá trị hằng dùng để so sánh với giá trị raw của biến. */
export type ComparisonValue = string | number | boolean;

/** `exists`: giá trị khác `undefined`/`null`. `notEmpty`: `exists` và không phải chuỗi rỗng/mảng rỗng. */
export interface PresenceCondition {
  readonly op: 'exists' | 'notEmpty';

  /** Tên biến cần kiểm tra. */
  readonly var: string;
}

/** So sánh giá trị raw của biến (trước khi format) với 1 hằng; `gt`/`gte`/`lt`/`lte` chỉ đúng khi cả 2 là số. */
export interface ComparisonCondition {
  readonly op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

  /** Tên biến cần so sánh. */
  readonly var: string;

  /** Hằng để so sánh. */
  readonly value: ComparisonValue;
}

/** `and`: mọi điều kiện con đúng. `or`: ít nhất 1 điều kiện con đúng. */
export interface GroupCondition {
  readonly op: 'and' | 'or';

  /** Các điều kiện con. */
  readonly conditions: readonly Condition[];
}

/** Phủ định 1 điều kiện. */
export interface NotCondition {
  readonly op: 'not';

  /** Điều kiện bị phủ định. */
  readonly condition: Condition;
}

/** Điều kiện ẩn/hiện node — data thuần, không phải biểu thức chuỗi, nên không cần parser/eval. */
export type Condition = PresenceCondition | ComparisonCondition | GroupCondition | NotCondition;

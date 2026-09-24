import type {
  ComparisonCondition,
  ComparisonValue,
  Condition,
  GroupCondition,
  NotCondition,
  PresenceCondition,
} from '../content/Condition';

/** Biến có giá trị (khác `undefined`/`null`). */
export function exists(variable: string): PresenceCondition {
  return { op: 'exists', var: variable };
}

/** Biến có giá trị và không phải chuỗi rỗng/mảng rỗng. */
export function notEmpty(variable: string): PresenceCondition {
  return { op: 'notEmpty', var: variable };
}

/** Giá trị raw của biến bằng `value`. */
export function eq(variable: string, value: ComparisonValue): ComparisonCondition {
  return { op: 'eq', var: variable, value };
}

/** Giá trị raw của biến khác `value`. */
export function neq(variable: string, value: ComparisonValue): ComparisonCondition {
  return { op: 'neq', var: variable, value };
}

/** Giá trị raw của biến lớn hơn `value` (chỉ đúng khi cả 2 là số). */
export function gt(variable: string, value: number): ComparisonCondition {
  return { op: 'gt', var: variable, value };
}

/** Giá trị raw của biến lớn hơn hoặc bằng `value`. */
export function gte(variable: string, value: number): ComparisonCondition {
  return { op: 'gte', var: variable, value };
}

/** Giá trị raw của biến nhỏ hơn `value`. */
export function lt(variable: string, value: number): ComparisonCondition {
  return { op: 'lt', var: variable, value };
}

/** Giá trị raw của biến nhỏ hơn hoặc bằng `value`. */
export function lte(variable: string, value: number): ComparisonCondition {
  return { op: 'lte', var: variable, value };
}

/** Mọi điều kiện con đều đúng. */
export function and(...conditions: Condition[]): GroupCondition {
  return { op: 'and', conditions };
}

/** Ít nhất 1 điều kiện con đúng. */
export function or(...conditions: Condition[]): GroupCondition {
  return { op: 'or', conditions };
}

/** Phủ định điều kiện. */
export function not(condition: Condition): NotCondition {
  return { op: 'not', condition };
}

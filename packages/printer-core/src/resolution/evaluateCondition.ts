import type { ComparisonCondition, Condition, TemplateNode } from '../template';
import { readVariableValue } from './readVariable';
import type { ResolveContext } from './ResolveContext';

type NumericOperator = 'gt' | 'gte' | 'lt' | 'lte';

const NUMERIC_COMPARATORS: Readonly<Record<NumericOperator, (left: number, right: number) => boolean>> = {
  gt: (left, right) => left > right,
  gte: (left, right) => left >= right,
  lt: (left, right) => left < right,
  lte: (left, right) => left <= right,
};

/** Node có hiện không; không có `visibleWhen` là luôn hiện. */
export function isNodeVisible(node: TemplateNode, context: ResolveContext): boolean {
  return node.visibleWhen === undefined || evaluateCondition(node.visibleWhen, context, node.id);
}

/** Đánh giá điều kiện trên giá trị raw của biến (trước khi format). */
export function evaluateCondition(
  condition: Condition,
  context: ResolveContext,
  nodeId: string,
): boolean {
  switch (condition.op) {
    case 'and':
      return condition.conditions.every((child) => evaluateCondition(child, context, nodeId));
    case 'or':
      return condition.conditions.some((child) => evaluateCondition(child, context, nodeId));
    case 'not':
      return !evaluateCondition(condition.condition, context, nodeId);
    case 'exists':
      return hasValue(readVariableValue(context, condition.var, nodeId));
    case 'notEmpty':
      return isNotEmpty(readVariableValue(context, condition.var, nodeId));
    default:
      return compare(condition, readVariableValue(context, condition.var, nodeId));
  }
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isNotEmpty(value: unknown): boolean {
  if (!hasValue(value) || value === '') return false;
  return !Array.isArray(value) || value.length > 0;
}

function compare(condition: ComparisonCondition, value: unknown): boolean {
  if (condition.op === 'eq') return value === condition.value;
  if (condition.op === 'neq') return value !== condition.value;

  // So sánh lớn/nhỏ chỉ có nghĩa với số; chuỗi như '45.000đ' không được so theo thứ tự chữ cái.
  if (typeof value !== 'number' || typeof condition.value !== 'number') return false;
  return NUMERIC_COMPARATORS[condition.op](value, condition.value);
}

import {
  optionConditionError,
  type ComparisonCondition,
  type Condition,
  type OptionCondition,
  type TemplateNode,
} from '../template';
import { readVariableValue } from './readVariable';
import type { ResolveContext } from './ResolveContext';
import { ResolveError } from './ResolveError';
import { readOptionSetting } from './readSetting';

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
    case 'option':
      return evaluateOptionCondition(condition, context, nodeId);
    default:
      return compare(condition, readVariableValue(context, condition.var, nodeId));
  }
}

// Không có `equals` nghĩa là "option boolean đang bật"; equals sai loại/ngoài danh sách phải báo lỗi rõ,
// không được âm thầm coi là không khớp (validate tĩnh có thể đã bỏ qua template này).
function evaluateOptionCondition(
  condition: OptionCondition,
  context: ResolveContext,
  nodeId: string,
): boolean {
  const option = readOptionSetting(context, condition.option, nodeId);
  const message = optionConditionError(option, condition);
  if (message !== undefined) throw new ResolveError(nodeId, message);

  if (condition.equals !== undefined) return option.value === condition.equals;
  return option.type === 'boolean' && option.value;
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

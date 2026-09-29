import { formatValue, type OptionSegment, type Segment, type VariableSegment } from '../template';
import { isOptionalVariable, readVariableValue, variableTypeOf } from './readVariable';
import type { ResolveContext } from './ResolveContext';
import { readOptionSetting } from './readSetting';
import { errorMessage, ResolveError } from './ResolveError';

/**
 * Ghép các segment thành chuỗi cần in: segment chữ giữ nguyên, segment biến đọc + format, segment option in
 * `value` của option.
 */
export function resolveContent(
  segments: readonly Segment[],
  context: ResolveContext,
  nodeId: string,
): string {
  return segments.map((segment) => resolveSegment(segment, context, nodeId)).join('');
}

function resolveSegment(
  segment: Segment,
  context: ResolveContext,
  nodeId: string,
): string {
  if ('text' in segment) return segment.text;
  if ('option' in segment) return resolveOptionSegment(segment, context, nodeId);

  const value = readVariableValue(context, segment.var, nodeId);
  if (value !== undefined && value !== null) return formatSegment(segment, value, context, nodeId);
  if (isOptionalVariable(context, segment.var)) return '';
  throw new ResolveError(nodeId, `biến "${segment.var}" không có giá trị`);
}

function resolveOptionSegment(
  segment: OptionSegment,
  context: ResolveContext,
  nodeId: string,
): string {
  const option = readOptionSetting(context, segment.option, nodeId);
  if (option.type !== 'text') throw new ResolveError(nodeId, `option "${segment.option}" không phải kiểu text`);
  return option.value;
}

function formatSegment(
  segment: VariableSegment,
  value: unknown,
  context: ResolveContext,
  nodeId: string,
): string {
  try {
    return formatValue(value, segment.format, variableTypeOf(context, segment.var));
  } catch (error) {
    throw new ResolveError(nodeId, `biến "${segment.var}": ${errorMessage(error)}`);
  }
}

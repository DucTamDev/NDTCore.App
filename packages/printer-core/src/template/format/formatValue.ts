import type { VariableType } from '../../catalog';
import type { ValueFormat } from '../content/ValueFormat';
import { formatCurrency } from './formatCurrency';
import { formatDateTime } from './formatDateTime';
import { formatNumber } from './formatNumber';
import { formatText } from './formatText';

/** Pattern mặc định cho biến kiểu `datetime` khi segment không khai báo `format`. */
export const DEFAULT_DATETIME_PATTERN = 'dd/MM/yyyy HH:mm';

/**
 * Đổi giá trị raw của biến thành chuỗi. `format` bỏ trống thì dùng mặc định theo kiểu biến:
 * `money` → currency, `datetime` → `DEFAULT_DATETIME_PATTERN`, kiểu khác → `String(value)`.
 * Throw nếu giá trị không hợp với format (VD format số cho chuỗi).
 */
export function formatValue(
  value: unknown,
  format: ValueFormat | undefined,
  type: VariableType
): string {
  const effectiveFormat = format ?? defaultFormatFor(type);
  if (effectiveFormat === undefined) return String(value);

  switch (effectiveFormat.type) {
    case 'number':
      return formatNumber(requireNumber(value), effectiveFormat.decimals);
    case 'currency':
      return formatCurrency(requireNumber(value), effectiveFormat);
    case 'datetime':
      return formatDateTime(value, effectiveFormat.pattern);
    case 'text':
      return formatText(value, effectiveFormat);
  }
}

function defaultFormatFor(type: VariableType): ValueFormat | undefined {
  if (type === 'money') return { type: 'currency' };
  if (type === 'datetime')
    return { type: 'datetime', pattern: DEFAULT_DATETIME_PATTERN };
  return undefined;
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number')
    throw new Error(`Giá trị "${String(value)}" không phải số`);
  return value;
}

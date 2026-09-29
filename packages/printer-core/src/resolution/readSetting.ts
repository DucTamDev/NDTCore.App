import type { OptionSetting, TextStyle } from '../template';
import type { ResolveContext } from './ResolveContext';
import { ResolveError } from './ResolveError';

/** Style chữ của style có tên `name` — luôn là `value`, `default` chỉ dành cho UI. */
export function readStyleSetting(
  context: ResolveContext,
  name: string,
  nodeId: string,
): TextStyle {
  const styles = context.settings.styles;
  if (!hasOwn(styles, name)) throw new ResolveError(nodeId, `settings không có style "${name}"`);
  return styles[name].value;
}

/** Option `name` trong settings; throw `ResolveError` nếu không có. */
export function readOptionSetting(
  context: ResolveContext,
  name: string,
  nodeId: string,
): OptionSetting {
  const options = context.settings.options;
  if (!hasOwn(options, name)) throw new ResolveError(nodeId, `settings không có option "${name}"`);
  return options[name];
}

// Tên setting đến từ JSON nên phải tra đúng key riêng, không trúng `toString`... của prototype.
function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

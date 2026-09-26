/** Tên các biến có sẵn, không cần khai báo trong catalog. */
export type BuiltInVariableName =
  | '$position'
  | '$total'
  | '$unit'
  | '$unitCount'
  | '$page'
  | '$pageCount'
  | '$part'
  | '$partCount';

/** Nơi dùng được 1 biến có sẵn: mọi chỗ / trong `repeat` / trong `repeat` có `expand`. */
export type BuiltInVariableScope = 'document' | 'repeat' | 'expand';

/** Tiền tố dành riêng cho biến có sẵn — catalog không được đặt tên biến bắt đầu bằng ký tự này. */
export const RESERVED_NAME_PREFIX = '$';

/** Scope hợp lệ của từng biến có sẵn. Mọi biến có sẵn đều có kiểu `number`. */
export const BUILT_IN_VARIABLE_SCOPES: Readonly<Record<BuiltInVariableName, BuiltInVariableScope>> = {
  $position: 'repeat',
  $total: 'repeat',
  $unit: 'expand',
  $unitCount: 'expand',
  $page: 'document',
  $pageCount: 'document',
  $part: 'document',
  $partCount: 'document',
};

/** Kiểm tra 1 tên có phải biến có sẵn không. */
export function isBuiltInVariableName(name: string): name is BuiltInVariableName {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_VARIABLE_SCOPES, name);
}

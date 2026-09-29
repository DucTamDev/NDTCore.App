import type { OptionSettingType } from '../settings';
import type { JsonCursor } from './JsonCursor';
import { validateTextStyleSetting } from './validateStyle';

type OptionValidator = (cursor: JsonCursor) => void;

// Record thay cho mảng để TypeScript báo lỗi khi union thêm loại option mà bảng này quên cập nhật.
const OPTION_VALIDATORS: Readonly<Record<OptionSettingType, OptionValidator>> = {
  boolean: validateBooleanOption,
  text: validateTextOption,
  choice: validateChoiceOption,
};

const OPTION_TYPES: readonly string[] = Object.keys(OPTION_VALIDATORS);

/** `value` dùng khi in và `default` cho UI phải cùng kiểu, nên kiểm như nhau. */
const VALUE_FIELDS: readonly string[] = ['value', 'default'];

/** Kiểm tra `settings`: nhãn, và `value`/`default` đúng kiểu theo từng style/option. */
export function validateSettings(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  for (const style of cursor.field('styles').expectEntries()) validateStyleSetting(style);
  for (const option of cursor.field('options').expectEntries()) validateOptionSetting(option);
}

function validateStyleSetting(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  cursor.field('label').expectNonEmptyString();
  for (const field of VALUE_FIELDS) validateTextStyleSetting(cursor.field(field));
}

function validateOptionSetting(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  cursor.field('label').expectNonEmptyString();
  const type = cursor.field('type');
  if (!type.expectOneOf(OPTION_TYPES)) return;
  OPTION_VALIDATORS[type.value as OptionSettingType](cursor);
}

function validateBooleanOption(cursor: JsonCursor): void {
  for (const field of VALUE_FIELDS) {
    if (typeof cursor.field(field).value !== 'boolean') cursor.field(field).report('phải là true hoặc false');
  }
}

function validateTextOption(cursor: JsonCursor): void {
  for (const field of VALUE_FIELDS) {
    if (typeof cursor.field(field).value !== 'string') cursor.field(field).report('phải là chuỗi');
  }
}

function validateChoiceOption(cursor: JsonCursor): void {
  const values = validateChoices(cursor.field('choices'));
  if (values.length === 0) return;
  for (const field of VALUE_FIELDS) cursor.field(field).expectOneOf(values);
}

// Trả các giá trị lựa chọn hợp lệ; danh sách hỏng thì trả rỗng để không báo thêm lỗi value/default dây chuyền.
function validateChoices(cursor: JsonCursor): readonly string[] {
  const items = cursor.expectItems();
  if (Array.isArray(cursor.value) && items.length === 0) cursor.report('phải có ít nhất 1 lựa chọn');

  const values: string[] = [];
  for (const item of items) {
    const value = validateChoice(item, values);
    if (value !== undefined) values.push(value);
  }
  return values;
}

function validateChoice(cursor: JsonCursor, seenValues: readonly string[]): string | undefined {
  if (!cursor.expectObject()) return undefined;

  cursor.field('label').expectNonEmptyString();
  const value = cursor.field('value');
  if (typeof value.value !== 'string' || value.value === '') {
    value.report('phải là chuỗi khác rỗng');
    return undefined;
  }
  if (seenValues.includes(value.value)) {
    value.report(`giá trị "${value.value}" bị trùng`);
    return undefined;
  }
  return value.value;
}

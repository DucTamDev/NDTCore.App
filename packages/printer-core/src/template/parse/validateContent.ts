import type { JsonCursor } from './JsonCursor';

/** Số chữ số thập phân tối đa cho format số/tiền. */
const MAX_FORMAT_DECIMALS = 6;

/** Giới hạn trên của `TextFormat.maxLength` — chỉ để chặn giá trị vô lý. */
const MAX_TEXT_LENGTH = 1000;

const FORMAT_TYPES: readonly string[] = ['number', 'currency', 'datetime', 'text'];
const CURRENCY_SYMBOLS: readonly string[] = ['đ', '₫', 'VND', ''];
const TEXT_TRANSFORMS: readonly string[] = ['upper', 'lower'];
const PRESENCE_OPERATORS: readonly string[] = ['exists', 'notEmpty'];
const COMPARISON_OPERATORS: readonly string[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
const GROUP_OPERATORS: readonly string[] = ['and', 'or'];

/** Kiểm tra mảng `Segment` (nội dung text/barcode/QR). */
export function validateSegments(cursor: JsonCursor): void {
  for (const segment of cursor.expectItems()) validateSegment(segment);
}

/** Kiểm tra `Condition` (đệ quy qua `and`/`or`/`not`). */
export function validateCondition(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  const operator = cursor.field('op').value;
  if (typeof operator === 'string' && PRESENCE_OPERATORS.includes(operator)) {
    cursor.field('var').expectNonEmptyString();
    return;
  }
  if (typeof operator === 'string' && COMPARISON_OPERATORS.includes(operator)) {
    validateComparison(cursor);
    return;
  }
  if (typeof operator === 'string' && GROUP_OPERATORS.includes(operator)) {
    validateGroup(cursor);
    return;
  }
  if (operator === 'not') {
    validateCondition(cursor.field('condition'));
    return;
  }
  cursor.field('op').report(`điều kiện "${String(operator)}" không hợp lệ`);
}

function validateSegment(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  if (cursor.has('text')) {
    if (typeof cursor.field('text').value !== 'string') cursor.field('text').report('phải là chuỗi');
    return;
  }
  if (!cursor.has('var')) {
    cursor.report('segment phải có "text" hoặc "var"');
    return;
  }
  cursor.field('var').expectNonEmptyString();
  if (cursor.has('format')) validateValueFormat(cursor.field('format'));
}

function validateValueFormat(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  const type = cursor.field('type');
  if (!type.expectOneOf(FORMAT_TYPES)) return;

  cursor.field('decimals').expectOptionalInteger(0, MAX_FORMAT_DECIMALS);
  if (type.value === 'currency') cursor.field('symbol').expectOptionalOneOf(CURRENCY_SYMBOLS);
  if (type.value === 'datetime') cursor.field('pattern').expectNonEmptyString();
  if (type.value === 'text') validateTextFormat(cursor);
}

function validateTextFormat(cursor: JsonCursor): void {
  cursor.field('transform').expectOptionalOneOf(TEXT_TRANSFORMS);
  cursor.field('maxLength').expectOptionalInteger(1, MAX_TEXT_LENGTH);
}

function validateComparison(cursor: JsonCursor): void {
  cursor.field('var').expectNonEmptyString();

  const valueType = typeof cursor.field('value').value;
  if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
    cursor.field('value').report('phải là chuỗi, số hoặc boolean');
  }
}

function validateGroup(cursor: JsonCursor): void {
  const conditions = cursor.field('conditions').expectItems();
  if (conditions.length === 0) cursor.field('conditions').report('phải có ít nhất 1 điều kiện');
  for (const condition of conditions) validateCondition(condition);
}

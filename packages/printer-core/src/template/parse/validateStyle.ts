import type { JsonCursor } from './JsonCursor';

const LENGTH_UNITS: readonly string[] = ['mm', 'pt', 'px'];
const DIMENSION_TYPES: readonly string[] = ['fixed', 'fill', 'auto'];
const INSET_SIDES: readonly string[] = ['top', 'right', 'bottom', 'left'];
const DIRECTIONS: readonly string[] = ['row', 'column'];
const JUSTIFY_CONTENT_VALUES: readonly string[] = ['start', 'center', 'end', 'space-between'];
const ALIGN_ITEMS_VALUES: readonly string[] = ['start', 'center', 'end'];
const FONT_WEIGHTS: readonly string[] = ['normal', 'bold'];
const TEXT_ALIGNS: readonly string[] = ['left', 'center', 'right'];

/** Kiểm tra `Length`: `value` là số hữu hạn không âm, `unit` là mm/pt/px. */
export function validateLength(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  const value = cursor.field('value').value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    cursor.field('value').report('phải là số không âm');
  }
  cursor.field('unit').expectOneOf(LENGTH_UNITS);
}

/** Kiểm tra field `Length` tuỳ chọn. */
export function validateOptionalLength(cursor: JsonCursor): void {
  if (cursor.value !== undefined) validateLength(cursor);
}

/** Kiểm tra `BoxStyle` (dùng cho node không có style riêng). */
export function validateBoxStyle(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;
  validateBoxFields(cursor);
}

/** Kiểm tra `LayoutStyle` của container. */
export function validateLayoutStyle(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;

  validateBoxFields(cursor);
  cursor.field('direction').expectOptionalOneOf(DIRECTIONS);
  validateOptionalLength(cursor.field('gap'));
  cursor.field('justifyContent').expectOptionalOneOf(JUSTIFY_CONTENT_VALUES);
  cursor.field('alignItems').expectOptionalOneOf(ALIGN_ITEMS_VALUES);
}

/** Kiểm tra `BoxStyle & TextStyle` của text. */
export function validateTextStyle(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;

  validateBoxFields(cursor);
  validateOptionalLength(cursor.field('fontSize'));
  cursor.field('fontWeight').expectOptionalOneOf(FONT_WEIGHTS);
  cursor.field('textAlign').expectOptionalOneOf(TEXT_ALIGNS);

  const lineHeight = cursor.field('lineHeight').value;
  if (lineHeight !== undefined && (typeof lineHeight !== 'number' || !(lineHeight > 0))) {
    cursor.field('lineHeight').report('phải là hệ số dương, VD 1.2');
  }
}

function validateBoxFields(cursor: JsonCursor): void {
  validateOptionalDimension(cursor.field('width'));
  validateOptionalDimension(cursor.field('height'));
  validateOptionalInsets(cursor.field('margin'));
  validateOptionalInsets(cursor.field('padding'));
}

function validateOptionalDimension(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;

  cursor.field('type').expectOneOf(DIMENSION_TYPES);
  if (cursor.field('type').value === 'fixed') validateLength(cursor.field('value'));
}

function validateOptionalInsets(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;

  for (const side of INSET_SIDES) validateLength(cursor.field(side));
}

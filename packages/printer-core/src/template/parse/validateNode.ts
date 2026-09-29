import type { BarcodeSymbology, QrErrorCorrectionLevel } from '../../symbology';
import type { TemplateNodeType } from '../nodes/TemplateNode';
import type { JsonCursor } from './JsonCursor';
import { validateCondition, validateSegments } from './validateContent';
import { validateBoxStyle, validateLayoutStyle, validateOptionalLength, validateTextStyle } from './validateStyle';

/** Số phần tử tối đa mỗi trang — chỉ để chặn giá trị vô lý. */
const MAX_ITEMS_PER_PAGE = 1000;

// Record thay cho mảng để TypeScript báo lỗi khi union thêm giá trị mà danh sách này quên cập nhật.
const BARCODE_SYMBOLOGIES: Readonly<Record<BarcodeSymbology, true>> = {
  code39: true,
  code93: true,
  code128: true,
  ean8: true,
  ean13: true,
  upca: true,
  upce: true,
  itf: true,
  codabar: true,
};

const QR_ERROR_CORRECTION_LEVELS: Readonly<Record<QrErrorCorrectionLevel, true>> = {
  L: true,
  M: true,
  Q: true,
  H: true,
};

const LINE_PATTERNS: readonly string[] = ['solid', 'dashed'];

/** Thuộc tính chữ mà style có tên trong `settings` quản lý. */
const TEXT_STYLE_FIELDS: readonly string[] = ['fontSize', 'fontWeight', 'lineHeight', 'textAlign'];

type NodeValidator = (cursor: JsonCursor, seenIds: Set<string>) => void;

const NODE_VALIDATORS: Readonly<Record<TemplateNodeType, NodeValidator>> = {
  container: validateContainer,
  text: validateText,
  line: validateLine,
  barcode: validateBarcode,
  qrcode: validateQrCode,
  image: validateImage,
  repeat: validateRepeat,
};

/** Kiểm tra 1 node và toàn bộ node con; `seenIds` dùng chung để phát hiện `id` trùng. */
export function validateNode(cursor: JsonCursor, seenIds: Set<string>): void {
  if (!cursor.expectObject()) return;

  validateNodeId(cursor.field('id'), seenIds);
  if (cursor.has('visibleWhen')) validateCondition(cursor.field('visibleWhen'));

  const type = cursor.field('type').value;
  const validator = typeof type === 'string' ? findNodeValidator(type) : undefined;
  if (!validator) {
    cursor.field('type').report(`loại node "${String(type)}" không hợp lệ`);
    return;
  }
  validator(cursor, seenIds);
}

function findNodeValidator(type: string): NodeValidator | undefined {
  if (!Object.prototype.hasOwnProperty.call(NODE_VALIDATORS, type)) return undefined;
  return NODE_VALIDATORS[type as TemplateNodeType];
}

function validateNodeId(cursor: JsonCursor, seenIds: Set<string>): void {
  if (typeof cursor.value !== 'string' || cursor.value === '') {
    cursor.report('phải là chuỗi khác rỗng');
    return;
  }
  if (seenIds.has(cursor.value)) cursor.report(`id "${cursor.value}" bị trùng`);
  seenIds.add(cursor.value);
}

function validateContainer(cursor: JsonCursor, seenIds: Set<string>): void {
  validateLayoutStyle(cursor.field('style'));
  for (const child of cursor.field('children').expectItems()) validateNode(child, seenIds);
}

function validateText(cursor: JsonCursor): void {
  validateSegments(cursor.field('content'));
  validateTextStyle(cursor.field('style'));
  if (cursor.has('styleName')) validateStyleName(cursor);
}

// Nếu cho trộn, người dùng chỉnh cỡ chữ trong settings mà bản in không đổi vì bị style viết thẳng đè.
function validateStyleName(cursor: JsonCursor): void {
  cursor.field('styleName').expectNonEmptyString();

  const style = cursor.field('style');
  for (const field of TEXT_STYLE_FIELDS) {
    if (style.has(field)) style.field(field).report('không dùng cùng styleName (style chữ lấy từ settings)');
  }
}

function validateLine(cursor: JsonCursor): void {
  validateOptionalLength(cursor.field('thickness'));
  cursor.field('pattern').expectOptionalOneOf(LINE_PATTERNS);
  validateBoxStyle(cursor.field('style'));
}

function validateBarcode(cursor: JsonCursor): void {
  validateSegments(cursor.field('content'));
  cursor.field('symbology').expectOneOf(Object.keys(BARCODE_SYMBOLOGIES));
  validateOptionalLength(cursor.field('barHeight'));
  validateBoxStyle(cursor.field('style'));

  const readable = cursor.field('readable').value;
  if (readable !== undefined && typeof readable !== 'boolean') cursor.field('readable').report('phải là boolean');
}

function validateQrCode(cursor: JsonCursor): void {
  validateSegments(cursor.field('content'));
  cursor.field('errorCorrection').expectOptionalOneOf(Object.keys(QR_ERROR_CORRECTION_LEVELS));
  validateOptionalLength(cursor.field('moduleSize'));
  validateBoxStyle(cursor.field('style'));
}

function validateImage(cursor: JsonCursor): void {
  validateBoxStyle(cursor.field('style'));

  const source = cursor.field('source');
  if (!source.expectObject()) return;
  if (source.has('asset') === source.has('var')) {
    source.report('phải có đúng 1 trong 2 field "asset" hoặc "var"');
    return;
  }
  source.field(source.has('asset') ? 'asset' : 'var').expectNonEmptyString();
}

function validateRepeat(cursor: JsonCursor, seenIds: Set<string>): void {
  cursor.field('collection').expectNonEmptyString();
  if (cursor.has('expand')) cursor.field('expand').expectNonEmptyString();
  cursor.field('maxItemsPerPage').expectOptionalInteger(1, MAX_ITEMS_PER_PAGE);
  validateNode(cursor.field('template'), seenIds);
}

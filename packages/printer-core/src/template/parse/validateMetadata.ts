import type { TemplateKind, TemplateLocale } from '../TemplateMetadata';
import type { JsonCursor } from './JsonCursor';

// Record thay cho mảng để TypeScript báo lỗi khi union thêm giá trị mà danh sách này quên cập nhật.
const TEMPLATE_KINDS: Readonly<Record<TemplateKind, true>> = { label: true, receipt: true };

const LOCALES: Readonly<Record<TemplateLocale, true>> = { 'vi-VN': true };

/** Kiểm tra `metadata`: mã, tên, locale, công dụng và khổ giấy khớp công dụng. */
export function validateMetadata(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  cursor.field('id').expectNonEmptyString();
  cursor.field('name').expectNonEmptyString();
  cursor.field('locale').expectOneOf(Object.keys(LOCALES));
  validatePaper(cursor);
}

function validatePaper(metadata: JsonCursor): void {
  const kind = metadata.field('kind');
  const paper = metadata.field('paper');
  if (!kind.expectOneOf(Object.keys(TEMPLATE_KINDS)) || !paper.expectObject()) return;

  if (!isPositiveNumber(paper.field('widthMm').value)) paper.field('widthMm').report('phải là số dương (mm)');

  const heightMm = paper.field('heightMm');
  if (kind.value === 'label' && !isPositiveNumber(heightMm.value)) {
    heightMm.report('tem (label) phải có chiều cao là số dương (mm)');
  }
  if (kind.value === 'receipt' && heightMm.value !== undefined) {
    heightMm.report('giấy cuộn (receipt) không có chiều cao cố định');
  }
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

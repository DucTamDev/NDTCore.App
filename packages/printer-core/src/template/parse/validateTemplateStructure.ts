import { TEMPLATE_SCHEMA_VERSION } from '../TemplateDocument';
import { JsonCursor } from './JsonCursor';
import type { TemplateIssue } from './TemplateIssue';
import { validateNode } from './validateNode';
import { validateRepeatPagination } from './validateRepeatPagination';

const MEDIA_TYPES: readonly string[] = ['label', 'receipt'];
const LOCALES: readonly string[] = ['vi-VN'];

/** Kiểm tra cấu trúc 1 document đã ở schema hiện tại; trả danh sách lỗi (rỗng là hợp lệ). */
export function validateTemplateStructure(document: unknown): readonly TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const cursor = JsonCursor.root(document, issues);
  if (!cursor.expectObject()) return issues;

  if (cursor.field('schemaVersion').value !== TEMPLATE_SCHEMA_VERSION) {
    cursor.field('schemaVersion').report(`phải là ${TEMPLATE_SCHEMA_VERSION}`);
  }
  cursor.field('id').expectNonEmptyString();
  cursor.field('name').expectNonEmptyString();
  cursor.field('dataId').expectNonEmptyString();
  cursor.field('locale').expectOneOf(LOCALES);
  validatePaper(cursor);
  validateNode(cursor.field('root'), new Set());
  // Ràng buộc tách tem dựa trên cấu trúc hợp lệ; chạy trên cấu trúc lỗi sẽ báo trùng lỗi kiểu.
  if (issues.length === 0) validateRepeatPagination(cursor.field('root'));

  return issues;
}

function validatePaper(document: JsonCursor): void {
  const media = document.field('media');
  const paper = document.field('paper');
  if (!media.expectOneOf(MEDIA_TYPES) || !paper.expectObject()) return;

  if (!isPositiveNumber(paper.field('widthMm').value)) paper.field('widthMm').report('phải là số dương (mm)');

  const heightMm = paper.field('heightMm');
  if (media.value === 'label' && !isPositiveNumber(heightMm.value)) {
    heightMm.report('tem (label) phải có chiều cao là số dương (mm)');
  }
  if (media.value === 'receipt' && heightMm.value !== undefined) {
    heightMm.report('giấy cuộn (receipt) không có chiều cao cố định');
  }
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

import { TEMPLATE_SCHEMA_VERSION } from '../TemplateDocument';
import { JsonCursor } from './JsonCursor';
import type { TemplateIssue } from './TemplateIssue';
import { validateMetadata } from './validateMetadata';
import { validateNode } from './validateNode';
import { validateRepeatPagination } from './validateRepeatPagination';
import { validateSettings } from './validateSettings';

/** Kiểm tra cấu trúc 1 document đã ở schema hiện tại; trả danh sách lỗi (rỗng là hợp lệ). */
export function validateTemplateStructure(document: unknown): readonly TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const cursor = JsonCursor.root(document, issues);
  if (!cursor.expectObject()) return issues;

  if (cursor.field('schemaVersion').value !== TEMPLATE_SCHEMA_VERSION) {
    cursor.field('schemaVersion').report(`phải là ${TEMPLATE_SCHEMA_VERSION}`);
  }
  validateMetadata(cursor.field('metadata'));
  validateSettings(cursor.field('settings'));
  validateNode(cursor.field('content'), new Set());
  // Ràng buộc tách tem dựa trên cấu trúc hợp lệ; chạy trên cấu trúc lỗi sẽ báo trùng lỗi kiểu.
  if (issues.length === 0) validateRepeatPagination(cursor.field('content'));

  return issues;
}

import type { TemplateDocument } from '../TemplateDocument';
import { migrateTemplate } from './migrateTemplate';
import type { ParseResult } from './TemplateIssue';
import { validateTemplateStructure } from './validateTemplateStructure';

/**
 * Đọc template từ nguồn không có kiểu (BE, file import): migrate về schema hiện tại rồi kiểm tra cấu trúc.
 * Không kiểm tra biến có khớp catalog — việc đó là của `validateTemplateAgainstCatalog`.
 */
export function parseTemplate(json: unknown): ParseResult {
  const migrated = migrateTemplate(json);
  if (!migrated.ok) return migrated;

  const issues = validateTemplateStructure(migrated.document);
  if (issues.length > 0) return { ok: false, issues };

  // Cấu trúc đã được kiểm tra đầy đủ ở trên, nên ép kiểu ở đây là an toàn.
  return { ok: true, template: migrated.document as unknown as TemplateDocument };
}

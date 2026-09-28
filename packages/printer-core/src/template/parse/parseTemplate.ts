import type { TemplateDocument } from '../TemplateDocument';
import type { ParseResult } from './TemplateIssue';
import { validateTemplateStructure } from './validateTemplateStructure';

/**
 * Đọc template từ nguồn không có kiểu (BE, file import) và kiểm tra cấu trúc. Template khác schema hiện tại bị từ
 * chối, không migrate. Không kiểm tra biến có khớp catalog — việc đó là của `validateTemplateAgainstCatalog`.
 */
export function parseTemplate(json: unknown): ParseResult {
  const issues = validateTemplateStructure(json);
  if (issues.length > 0) return { ok: false, issues };

  // Cấu trúc đã được kiểm tra đầy đủ ở trên, nên ép kiểu ở đây là an toàn.
  return { ok: true, template: json as TemplateDocument };
}

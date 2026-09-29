import type { TemplateNode } from './nodes/TemplateNode';
import type { TemplateSettings } from './settings';
import type { TemplateMetadata } from './TemplateMetadata';

/** Phiên bản schema hiện tại của `TemplateDocument`; tăng khi đổi cấu trúc JSON, template bản cũ bị bỏ. */
export const TEMPLATE_SCHEMA_VERSION = 1;

/** Template in dạng JSON thuần: chỉ chứa cấu trúc + placeholder, không chứa data, ảnh hay hàm. */
export interface TemplateDocument {
  /** Phiên bản schema; phải đúng `TEMPLATE_SCHEMA_VERSION`, khác là `parseTemplate` từ chối (không migrate). */
  readonly schemaVersion: typeof TEMPLATE_SCHEMA_VERSION;

  /** Thông tin chung: mã, tên, công dụng, locale, khổ giấy. */
  readonly metadata: TemplateMetadata;

  /** Style có tên và option người dùng được chỉnh. */
  readonly settings: TemplateSettings;

  /** Cây node nội dung. */
  readonly content: TemplateNode;
}

import type { TemplateNode } from './nodes/TemplateNode';

/** Phiên bản schema hiện tại của `TemplateDocument`; tăng khi đổi cấu trúc JSON, template bản cũ bị bỏ. */
export const TEMPLATE_SCHEMA_VERSION = 1;

/** Loại giấy: `label` có chiều cao cố định và phân trang, `receipt` là giấy cuộn. */
export type TemplateMedia = 'label' | 'receipt';

/** Locale quyết định dấu phân cách số; hiện chỉ hỗ trợ tiếng Việt. */
export type TemplateLocale = 'vi-VN';

/** Khổ giấy, tính bằng mm. */
export interface PaperSize {
  /** Chiều rộng vùng in, mm. */
  readonly widthMm: number;

  /** Chiều cao 1 tem, mm; chỉ có ở `label`. */
  readonly heightMm?: number;
}

/** Template in dạng JSON thuần: chỉ chứa cấu trúc + placeholder, không chứa data, ảnh hay hàm. */
export interface TemplateDocument {
  /** Phiên bản schema; phải đúng `TEMPLATE_SCHEMA_VERSION`, khác là `parseTemplate` từ chối (không migrate). */
  readonly schemaVersion: typeof TEMPLATE_SCHEMA_VERSION;

  /** Mã template do người tạo đặt hoặc BE cấp. */
  readonly id: string;

  /** Tên hiển thị, VD 'Tem món mặc định'. */
  readonly name: string;

  /** Mã `TemplateDataDefinition` cung cấp biến cho template, VD 'product-label'. */
  readonly dataId: string;

  /** Loại giấy. */
  readonly media: TemplateMedia;

  /** Locale của template. */
  readonly locale: TemplateLocale;

  /** Khổ giấy. */
  readonly paper: PaperSize;

  /** Node gốc. */
  readonly root: TemplateNode;
}

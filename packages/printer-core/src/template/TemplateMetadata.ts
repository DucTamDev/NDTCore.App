import type { PaperSize } from './PaperSize';

/** Công dụng của template, trùng `PrintType` của app: `receipt` là hoá đơn, `label` là tem. */
export type TemplateKind = 'label' | 'receipt';

/** Locale quyết định dấu phân cách số; hiện chỉ hỗ trợ tiếng Việt. */
export type TemplateLocale = 'vi-VN';

/** Thông tin chung của template. */
export interface TemplateMetadata {
  /** Mã template do người tạo đặt hoặc BE cấp. */
  readonly id: string;

  /** Tên hiển thị, VD 'Tem món mặc định'. */
  readonly name: string;

  /** Công dụng; app chọn dữ liệu template theo field này. */
  readonly kind: TemplateKind;

  /** Locale của template. */
  readonly locale: TemplateLocale;

  /** Khổ giấy. */
  readonly paper: PaperSize;
}

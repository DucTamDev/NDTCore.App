import type { PaperSize } from '../PaperSize';
import type { TemplateKind, TemplateLocale } from '../TemplateMetadata';

/** Khổ giấy theo công dụng: label bắt buộc có chiều cao, receipt không có. */
export type PaperFor<TKind extends TemplateKind> = TKind extends 'label'
  ? Required<PaperSize>
  : Omit<PaperSize, 'heightMm'>;

/** Tham số của `.metadata(...)`; `kind` do `labelTemplate`/`receiptTemplate` quyết định. */
export interface TemplateMetadataInput<TKind extends TemplateKind> {
  /** Mã template. */
  readonly id: string;

  /** Tên hiển thị. */
  readonly name: string;

  /** Khổ giấy, đúng loại theo công dụng. */
  readonly paper: PaperFor<TKind>;

  /** Locale; mặc định `'vi-VN'`. */
  readonly locale?: TemplateLocale;
}

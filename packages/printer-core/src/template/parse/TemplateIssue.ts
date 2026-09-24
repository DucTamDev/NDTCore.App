import type { TemplateDocument } from '../TemplateDocument';

/** 1 lỗi (hoặc cảnh báo) trong template, kèm vị trí. */
export interface TemplateIssue {
  /** Đường dẫn JSON tới chỗ lỗi, VD `root.children[2].style.padding.top`; rỗng là cả document. */
  readonly path: string;

  /** Mô tả lỗi bằng tiếng Việt, hiển thị được cho người dùng. */
  readonly message: string;
}

/** Kết quả `parseTemplate`: template đã migrate + hợp lệ, hoặc danh sách lỗi. */
export type ParseResult =
  | { readonly ok: true; readonly template: TemplateDocument }
  | { readonly ok: false; readonly issues: readonly TemplateIssue[] };

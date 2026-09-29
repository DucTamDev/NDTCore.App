import type { PrintElement } from '../document';

/** Kết quả layout 1 trang: element đã xếp vị trí (dots) + cảnh báo nội dung tràn khổ giấy. */
export interface LayoutResult {
  /** Element đã xếp vị trí, dots. */
  readonly elements: PrintElement[];

  /** Cảnh báo tràn chiều rộng giấy hoặc chiều cao tem; rỗng khi nội dung vừa khổ. */
  readonly warnings: readonly string[];
}

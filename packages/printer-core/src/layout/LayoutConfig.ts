import type { PaperSize, TemplateMedia } from '../template';

/** Thông số máy in đích để layout: khổ giấy của template + DPI của máy. */
export interface LayoutConfig {
  /** Khổ giấy, mm — lấy từ `TemplateDocument.paper`. */
  readonly paper: PaperSize;

  /** Label thì tự thu nhỏ chữ cho vừa chiều cao tem; receipt thì không. */
  readonly media: TemplateMedia;

  /** Mật độ điểm của máy in, VD 203 hoặc 300. */
  readonly dpi: number;
}

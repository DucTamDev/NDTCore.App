import type { PaperSize } from '../template';

/** Thông số máy in đích để layout: khổ giấy của template + DPI của máy. */
export interface LayoutConfig {
  /** Khổ giấy, mm — lấy từ `TemplateDocument.metadata.paper`. */
  readonly paper: PaperSize;

  /** Mật độ điểm của máy in, VD 203 hoặc 300. */
  readonly dpi: number;
}

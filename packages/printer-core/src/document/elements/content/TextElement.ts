import type { Alignment, Rotation } from '../../../types';

/** Options cho 1 element text. */
export interface TextOptions {
  /** Toạ độ X, tính bằng dots. */
  x?: number;
  /** Toạ độ Y, tính bằng dots. */
  y?: number;
  /** Tên/mã font gốc của máy in — ý nghĩa khác nhau tuỳ từng ngôn ngữ. */
  font?: string;
  /** Hệ số phóng đại font (thường 1-8 tuỳ ngôn ngữ). */
  size?: number;
  /** Hệ số phóng đại ngang riêng, dùng cho ngôn ngữ tách scale x/y khỏi `size`. */
  xScale?: number;
  /** Hệ số phóng đại dọc riêng, dùng cho ngôn ngữ tách scale x/y khỏi `size`. */
  yScale?: number;
  /** Góc xoay của text. */
  rotation?: Rotation;
  bold?: boolean;
  underline?: boolean;
  /** In chữ trắng nền đen thay vì đen nền trắng. */
  reverse?: boolean;
  /** Căn lề ngang — chỉ có tác dụng khi có set `maxWidth`. */
  align?: Alignment;
  /** Độ rộng khung wrap/căn lề, tính bằng dots. */
  maxWidth?: number;
  /** Khoảng cách thêm giữa các dòng khi wrap, tính bằng dots. */
  lineSpacing?: number;
}

/** Một đoạn text, định vị và style theo `TextOptions`. */
export interface TextElement {
  type: 'text';
  content: string;
  options?: TextOptions;
}

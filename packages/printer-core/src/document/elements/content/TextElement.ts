import type { Alignment, Rotation } from '../../../types';

/** Options cho 1 element text. */
export interface TextOptions {
  /** Toạ độ X, tính bằng dots. */
  x?: number;

  /** Toạ độ Y, tính bằng dots. */
  y?: number;

  /** Cỡ chữ (chiều cao glyph danh nghĩa), dots; mỗi compiler tự quy đổi sang font/hệ số phóng đại của máy in. */
  fontSize?: number;

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

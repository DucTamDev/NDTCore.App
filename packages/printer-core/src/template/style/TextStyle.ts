import type { Length } from './Length';

/** Cỡ chữ mặc định khi `TextStyle.fontSize` bỏ trống. */
export const DEFAULT_FONT_SIZE: Length = { value: 12, unit: 'px' };

/** Style chữ của `TextNode`. */
export interface TextStyle {
  /** Cỡ chữ (chiều cao glyph danh nghĩa); mặc định `DEFAULT_FONT_SIZE`. */
  readonly fontSize?: Length;

  /** Độ đậm; mặc định `normal`. */
  readonly fontWeight?: 'normal' | 'bold';

  /** Hệ số chiều cao dòng so với cỡ chữ, không đơn vị (VD 1.2), giống CSS; mặc định 1.2. */
  readonly lineHeight?: number;

  /** Căn lề ngang; mặc định `left`. */
  readonly textAlign?: 'left' | 'center' | 'right';
}

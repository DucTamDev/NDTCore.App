import type { BoxStyle } from '../style/BoxStyle';
import type { Length } from '../style/Length';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Kiểu nét kẻ. */
export type LinePattern = 'solid' | 'dashed';

/** Đường kẻ ngang; dài hết chiều rộng còn trống, trừ khi `style.width` là `fixed`. */
export interface LineNode extends TemplateNodeBase {
  readonly type: 'line';

  /** Độ dày nét; mặc định theo máy in (thường 1 dot). */
  readonly thickness?: Length;

  /** Kiểu nét; mặc định `solid`. */
  readonly pattern?: LinePattern;

  /** Style hộp. */
  readonly style?: BoxStyle;
}

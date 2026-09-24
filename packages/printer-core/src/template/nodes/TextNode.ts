import type { Segment } from '../content/Segment';
import type { BoxStyle } from '../style/BoxStyle';
import type { TextStyle } from '../style/TextStyle';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Đoạn chữ, tự xuống dòng theo chiều rộng còn trống. */
export interface TextNode extends TemplateNodeBase {
  readonly type: 'text';

  /** Nội dung: các segment ghép liền nhau thành 1 chuỗi. */
  readonly content: readonly Segment[];

  /** Style hộp và style chữ. */
  readonly style?: BoxStyle & TextStyle;
}

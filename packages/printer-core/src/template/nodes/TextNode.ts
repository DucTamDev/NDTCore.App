import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';
import type { TextStyle } from '../style/TextStyle';

export interface TextNode extends TemplateNodeBase {
  readonly type: 'text';
  readonly text?: string;
  readonly binding?: string;
  readonly style?: BoxStyle & TextStyle;
}

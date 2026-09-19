import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';

export interface LineNode extends TemplateNodeBase {
  readonly type: 'line';
  readonly thickness?: number;
  readonly style?: BoxStyle;
}

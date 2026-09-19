import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';
import type { Bitmap } from '../../types';

export interface ImageNode extends TemplateNodeBase {
  readonly type: 'image';
  readonly bitmap?: Bitmap;
  readonly binding?: string;
  readonly style?: BoxStyle;
}

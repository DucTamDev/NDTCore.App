import type { TemplateNodeBase } from './TemplateNodeBase';
import type { LayoutStyle } from '../style/LayoutStyle';
import type { TemplateNode } from './TemplateNode';

export interface ContainerNode extends TemplateNodeBase {
  readonly type: 'container';
  readonly style?: LayoutStyle;
  readonly children: readonly TemplateNode[];
}

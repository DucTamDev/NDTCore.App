import type { LayoutStyle } from '../style/LayoutStyle';
import type { TemplateNode } from './TemplateNode';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Hộp chứa, xếp các node con theo hàng hoặc cột. */
export interface ContainerNode extends TemplateNodeBase {
  readonly type: 'container';

  /** Style layout của hộp chứa. */
  readonly style?: LayoutStyle;

  /** Các node con, xếp theo thứ tự khai báo. */
  readonly children: readonly TemplateNode[];
}

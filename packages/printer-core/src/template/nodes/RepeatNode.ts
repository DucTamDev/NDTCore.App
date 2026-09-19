import type { VisibilityCondition } from '../style/VisibilityCondition';
import type { TemplateNode } from './TemplateNode';

export interface RepeatNode {
  readonly type: 'repeat';
  readonly id: string;
  readonly binding: string;
  readonly template: TemplateNode;
  readonly maxItemsPerPage?: number;
  readonly visibleWhen?: VisibilityCondition;
}

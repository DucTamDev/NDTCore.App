import type { VisibilityCondition } from '../style/VisibilityCondition';

export interface TemplateNodeBase {
  readonly id: string;
  readonly visibleWhen?: VisibilityCondition;
}

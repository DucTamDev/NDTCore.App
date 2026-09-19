import type { BuildContext } from './BuildContext';
import type { RepeatNode } from '../nodes/RepeatNode';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { VisibilityCondition } from '../style/VisibilityCondition';
import type { NodeBuilder } from './NodeBuilder';

class RepeatBuilder {
  private nodeId?: string;
  private readonly bindingPath: string;
  private templateBuilder?: NodeBuilder<TemplateNode>;
  private perPage?: number;
  private visibility?: VisibilityCondition;

  constructor(binding: string) { this.bindingPath = binding; }

  id(value: string): this { this.nodeId = value; return this; }
  template(node: NodeBuilder<TemplateNode>): this { this.templateBuilder = node; return this; }
  maxItemsPerPage(value: number): this { this.perPage = value; return this; }
  visibleWhen(condition: VisibilityCondition): this { this.visibility = condition; return this; }

  build(context: BuildContext): RepeatNode {
    if (!this.templateBuilder) throw new Error(`Repeat "${this.bindingPath}" requires a .template(...)`);
    return {
      type: 'repeat',
      id: this.nodeId ?? context.idGenerator.next('repeat'),
      binding: this.bindingPath,
      template: this.templateBuilder.build(context),
      ...(this.perPage !== undefined ? { maxItemsPerPage: this.perPage } : {}),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export function repeat(binding: string): RepeatBuilder { return new RepeatBuilder(binding); }
export type { RepeatBuilder };

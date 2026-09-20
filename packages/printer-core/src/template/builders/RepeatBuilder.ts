import type { BuildContext } from './BuildContext';
import type { RepeatNode } from '../nodes/RepeatNode';
import type { TemplateNode } from '../nodes/TemplateNode';
import { TemplateNodeBuilder, type NodeBuilder } from './NodeBuilder';

class RepeatBuilder extends TemplateNodeBuilder<RepeatNode> {
  private readonly bindingPath: string;
  private templateBuilder?: NodeBuilder<TemplateNode>;
  private perPage?: number;

  constructor(binding: string) { super(); this.bindingPath = binding; }

  template(node: NodeBuilder<TemplateNode>): this { this.templateBuilder = node; return this; }
  maxItemsPerPage(value: number): this {
    if (value <= 0 || !Number.isFinite(value)) throw new Error('maxItemsPerPage must be a positive integer');
    this.perPage = value;
    return this;
  }

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

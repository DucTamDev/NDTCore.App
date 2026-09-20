import { PrintTemplateType } from '../PrintTemplateType';
import type { LabelTemplate } from '../PrintTemplate';
import type { LayoutConfig } from '../../layout/LayoutConfig';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { TemplateNodeBuilder } from './NodeBuilder';
import { TemplateNodeIdGenerator } from './BuildContext';
import type { BuildContext } from './BuildContext';

class LabelTemplateBuilder {
  private layoutConfig?: LayoutConfig;
  private rootBuilder?: TemplateNodeBuilder<TemplateNode>;

  size(config: LayoutConfig): this { this.layoutConfig = config; return this; }
  root(node: TemplateNodeBuilder<TemplateNode>): this { this.rootBuilder = node; return this; }

  build(): LabelTemplate {
    if (!this.layoutConfig) throw new Error('Label template requires .size(...)');
    if (!this.rootBuilder) throw new Error('Print template requires .root(...)');

    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    return Object.freeze({
      id: context.idGenerator.next('template'),
      version: 1,
      type: PrintTemplateType.Label,
      config: this.layoutConfig,
      root: this.rootBuilder.build(context),
    });
  }
}

export function labelTemplate(): LabelTemplateBuilder { return new LabelTemplateBuilder(); }
export type { LabelTemplateBuilder };

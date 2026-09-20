import { PrintTemplateType } from '../PrintTemplateType';
import type { ReceiptTemplate } from '../PrintTemplate';
import type { LayoutConfig } from '../../layout/LayoutConfig';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { TemplateNodeBuilder } from './NodeBuilder';
import { TemplateNodeIdGenerator } from './BuildContext';
import type { BuildContext } from './BuildContext';

class ReceiptTemplateBuilder {
  private layoutConfig?: Omit<LayoutConfig, 'heightDots'>;
  private rootBuilder?: TemplateNodeBuilder<TemplateNode>;

  size(config: Omit<LayoutConfig, 'heightDots'>): this { this.layoutConfig = config; return this; }
  root(node: TemplateNodeBuilder<TemplateNode>): this { this.rootBuilder = node; return this; }

  build(): ReceiptTemplate {
    if (!this.layoutConfig) throw new Error('Receipt template requires .size(...)');
    if (!this.rootBuilder) throw new Error('Print template requires .root(...)');

    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    return Object.freeze({
      id: context.idGenerator.next('template'),
      version: 1,
      type: PrintTemplateType.Receipt,
      config: this.layoutConfig,
      root: this.rootBuilder.build(context),
    });
  }
}

export function receiptTemplate(): ReceiptTemplateBuilder { return new ReceiptTemplateBuilder(); }
export type { ReceiptTemplateBuilder };

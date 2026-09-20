import { NodeBuilder, TemplateNodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { ContainerNode } from '../nodes/ContainerNode';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { LayoutStyle } from '../style/LayoutStyle';

class ContainerBuilder extends NodeBuilder<ContainerNode> {
  private readonly direction: 'row' | 'column';
  private readonly childBuilders: TemplateNodeBuilder<TemplateNode>[] = [];
  private gapValue?: number;
  private justify?: LayoutStyle['justifyContent'];
  private align?: LayoutStyle['alignItems'];

  constructor(direction: 'row' | 'column') { super(); this.direction = direction; }

  gap(value: number): this { this.gapValue = value; return this; }
  justifyContent(value: LayoutStyle['justifyContent']): this { this.justify = value; return this; }
  alignItems(value: LayoutStyle['alignItems']): this { this.align = value; return this; }
  children(...builders: TemplateNodeBuilder<TemplateNode>[]): this { this.childBuilders.push(...builders); return this; }

  build(context: BuildContext): ContainerNode {
    return {
      type: 'container',
      id: this.nodeId ?? context.idGenerator.next('container'),
      style: {
        ...this.boxStyle,
        direction: this.direction,
        ...(this.gapValue !== undefined ? { gap: this.gapValue } : {}),
        ...(this.justify !== undefined ? { justifyContent: this.justify } : {}),
        ...(this.align !== undefined ? { alignItems: this.align } : {}),
      },
      children: this.childBuilders.map((child) => child.build(context)),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export function column(): ContainerBuilder { return new ContainerBuilder('column'); }
export function row(): ContainerBuilder { return new ContainerBuilder('row'); }
export type { ContainerBuilder };

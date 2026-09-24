import type { ContainerNode } from '../nodes/ContainerNode';
import type { LayoutStyle } from '../style/LayoutStyle';
import type { Length } from '../style/Length';
import type { BuildContext } from './BuildContext';
import { NodeBuilder, type TemplateNodeBuilder } from './NodeBuilder';

/** Builder của container xếp node con theo hàng hoặc cột. */
export class ContainerBuilder extends NodeBuilder<ContainerNode> {
  private readonly childBuilders: TemplateNodeBuilder[] = [];

  private layout: LayoutStyle;

  constructor(direction: 'row' | 'column') {
    super();
    this.layout = { direction };
  }

  gap(value: Length): this {
    this.layout = { ...this.layout, gap: value };
    return this;
  }

  justifyContent(value: NonNullable<LayoutStyle['justifyContent']>): this {
    this.layout = { ...this.layout, justifyContent: value };
    return this;
  }

  alignItems(value: NonNullable<LayoutStyle['alignItems']>): this {
    this.layout = { ...this.layout, alignItems: value };
    return this;
  }

  children(...builders: TemplateNodeBuilder[]): this {
    this.childBuilders.push(...builders);
    return this;
  }

  build(context: BuildContext): ContainerNode {
    return {
      type: 'container',
      id: this.resolveId(context, 'container'),
      ...this.visibilityField(),
      style: { ...this.boxStyle, ...this.layout },
      children: this.childBuilders.map((child) => child.build(context)),
    };
  }
}

/** Container xếp node con theo cột (từ trên xuống). */
export function column(): ContainerBuilder {
  return new ContainerBuilder('column');
}

/** Container xếp node con theo hàng (từ trái sang). */
export function row(): ContainerBuilder {
  return new ContainerBuilder('row');
}

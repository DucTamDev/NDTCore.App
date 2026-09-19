import type { TemplateNode } from '../nodes/TemplateNode';
import type { BoxStyle } from '../style/BoxStyle';
import type { Dimension } from '../style/Dimension';
import type { Insets } from '../style/Insets';
import type { VisibilityCondition } from '../style/VisibilityCondition';
import type { BuildContext } from './BuildContext';

export abstract class NodeBuilder<TNode extends TemplateNode> {
  protected nodeId?: string;
  protected boxStyle: BoxStyle = {};
  protected visibility?: VisibilityCondition;

  id(value: string): this { this.nodeId = value; return this; }
  width(value: Dimension): this { this.boxStyle = { ...this.boxStyle, width: value }; return this; }
  height(value: Dimension): this { this.boxStyle = { ...this.boxStyle, height: value }; return this; }
  margin(value: Insets): this { this.boxStyle = { ...this.boxStyle, margin: value }; return this; }
  padding(value: Insets): this { this.boxStyle = { ...this.boxStyle, padding: value }; return this; }
  visibleWhen(condition: VisibilityCondition): this { this.visibility = condition; return this; }

  abstract build(context: BuildContext): TNode;
}

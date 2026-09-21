import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { LineNode } from '../nodes/LineNode';

class LineBuilder extends NodeBuilder<LineNode> {
  private thicknessValue?: number;

  thickness(value: number): this { this.thicknessValue = value; return this; }

  build(context: BuildContext): LineNode {
    return {
      type: 'line',
      id: this.nodeId ?? context.idGenerator.next('line'),
      style: this.boxStyle,
      ...(this.thicknessValue !== undefined ? { thickness: this.thicknessValue } : {}),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export function line(): LineBuilder { return new LineBuilder(); }
export type { LineBuilder };

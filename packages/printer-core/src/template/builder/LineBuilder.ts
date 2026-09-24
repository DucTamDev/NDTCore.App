import type { LineNode } from '../nodes/LineNode';
import type { Length } from '../style/Length';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';

/** Builder của đường kẻ ngang. */
export class LineBuilder extends NodeBuilder<LineNode> {
  private thicknessValue?: Length;

  private isDashed = false;

  /** Độ dày nét. */
  thickness(value: Length): this {
    this.thicknessValue = value;
    return this;
  }

  /** Nét đứt thay vì nét liền. */
  dashed(): this {
    this.isDashed = true;
    return this;
  }

  build(context: BuildContext): LineNode {
    return {
      type: 'line',
      id: this.resolveId(context, 'line'),
      ...this.visibilityField(),
      ...(this.thicknessValue !== undefined ? { thickness: this.thicknessValue } : {}),
      ...(this.isDashed ? { pattern: 'dashed' as const } : {}),
      ...this.styleField(this.boxStyle),
    };
  }
}

/** Đường kẻ ngang, dài hết chiều rộng còn trống (hoặc theo `width(fixed(...))`). */
export function line(): LineBuilder {
  return new LineBuilder();
}

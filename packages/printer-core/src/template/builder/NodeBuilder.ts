import type { Condition } from '../content/Condition';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { BoxStyle } from '../style/BoxStyle';
import type { Dimension } from '../style/Dimension';
import type { Insets } from '../style/Insets';
import type { BuildContext } from './BuildContext';

/** Builder gốc của mọi node: đặt `id` và điều kiện hiển thị. */
export abstract class TemplateNodeBuilder<TNode extends TemplateNode = TemplateNode> {
  protected nodeId?: string;

  protected visibility?: Condition;

  /** Đặt `id` node; bỏ qua thì tự sinh dạng `text-1`. */
  id(value: string): this {
    this.nodeId = value;
    return this;
  }

  /** Chỉ hiện node khi điều kiện đúng. */
  visibleWhen(condition: Condition): this {
    this.visibility = condition;
    return this;
  }

  abstract build(context: BuildContext): TNode;

  /** `id` đã đặt hoặc id tự sinh theo loại node. */
  protected resolveId(context: BuildContext, nodeType: TNode['type']): string {
    return this.nodeId ?? context.idGenerator.next(nodeType);
  }

  /** Field `visibleWhen` để spread vào node; rỗng nếu không đặt, để JSON không có field `undefined`. */
  protected visibilityField(): { readonly visibleWhen?: Condition } {
    return this.visibility ? { visibleWhen: this.visibility } : {};
  }
}

/** Builder của node có style hộp (mọi node trừ `repeat`). */
export abstract class NodeBuilder<TNode extends TemplateNode = TemplateNode> extends TemplateNodeBuilder<TNode> {
  protected boxStyle: BoxStyle = {};

  width(value: Dimension): this {
    this.boxStyle = { ...this.boxStyle, width: value };
    return this;
  }

  height(value: Dimension): this {
    this.boxStyle = { ...this.boxStyle, height: value };
    return this;
  }

  margin(value: Insets): this {
    this.boxStyle = { ...this.boxStyle, margin: value };
    return this;
  }

  padding(value: Insets): this {
    this.boxStyle = { ...this.boxStyle, padding: value };
    return this;
  }

  /** Field `style` để spread vào node; bỏ hẳn field khi style rỗng cho JSON gọn. */
  protected styleField<TStyle extends BoxStyle>(style: TStyle): { readonly style?: TStyle } {
    return Object.keys(style).length > 0 ? { style } : {};
  }
}

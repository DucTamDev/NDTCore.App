import type { Segment } from '../content/Segment';
import type { TextNode } from '../nodes/TextNode';
import type { Length } from '../style/Length';
import type { TextStyle } from '../style/TextStyle';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';
import { toSegments, type SegmentInput } from './segments';
import type { StyleReference } from './StyleReference';

/** Builder của đoạn chữ. */
export class TextBuilder extends NodeBuilder<TextNode> {
  private readonly content: readonly Segment[];

  private textStyle: TextStyle = {};

  private styleName?: string;

  constructor(content: SegmentInput) {
    super();
    this.content = toSegments(content);
  }

  fontSize(value: Length): this {
    this.textStyle = { ...this.textStyle, fontSize: value };
    return this;
  }

  bold(): this {
    this.textStyle = { ...this.textStyle, fontWeight: 'bold' };
    return this;
  }

  align(value: NonNullable<TextStyle['textAlign']>): this {
    this.textStyle = { ...this.textStyle, textAlign: value };
    return this;
  }

  /** Dùng style có tên trong settings (tạo qua `scope.style(...)`) thay cho cỡ chữ/đậm/căn lề viết thẳng. */
  style(reference: StyleReference): this {
    this.styleName = reference.styleName;
    return this;
  }

  /** Hệ số chiều cao dòng so với cỡ chữ, VD 1.2. */
  lineHeight(ratio: number): this {
    this.textStyle = { ...this.textStyle, lineHeight: ratio };
    return this;
  }

  build(context: BuildContext): TextNode {
    return {
      type: 'text',
      id: this.resolveId(context, 'text'),
      ...this.visibilityField(),
      content: this.content,
      ...(this.styleName === undefined ? {} : { styleName: this.styleName }),
      ...this.styleField({ ...this.boxStyle, ...this.textStyle }),
    };
  }
}

/** Đoạn chữ: chuỗi cố định, hoặc mảng segment ghép chữ + biến. */
export function text(content: SegmentInput): TextBuilder {
  return new TextBuilder(content);
}

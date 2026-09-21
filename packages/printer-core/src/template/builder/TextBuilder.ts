import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { TextNode } from '../nodes/TextNode';
import type { TextStyle } from '../style/TextStyle';

type TextContent = { readonly kind: 'literal'; readonly value: string } | { readonly kind: 'binding'; readonly path: string };

class TextBuilder extends NodeBuilder<TextNode> {
  private readonly content: TextContent;
  private textStyle: TextStyle = {};

  constructor(content: TextContent) { super(); this.content = content; }

  fontSize(value: number): this { this.textStyle = { ...this.textStyle, fontSize: value }; return this; }
  bold(): this { this.textStyle = { ...this.textStyle, fontWeight: 'bold' }; return this; }
  align(value: TextStyle['textAlign']): this { this.textStyle = { ...this.textStyle, textAlign: value }; return this; }
  lineHeight(value: number): this { this.textStyle = { ...this.textStyle, lineHeight: value }; return this; }

  build(context: BuildContext): TextNode {
    return {
      type: 'text',
      id: this.nodeId ?? context.idGenerator.next('text'),
      style: { ...this.boxStyle, ...this.textStyle },
      ...(this.content.kind === 'literal' ? { text: this.content.value } : { binding: this.content.path }),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export const text = {
  literal(value: string): TextBuilder { return new TextBuilder({ kind: 'literal', value }); },
  binding(path: string): TextBuilder { return new TextBuilder({ kind: 'binding', path }); },
};
export type { TextBuilder };

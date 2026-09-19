import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { ImageNode } from '../nodes/ImageNode';
import type { Bitmap } from '../../types';

type ImageContent = { readonly kind: 'bitmap'; readonly value: Bitmap } | { readonly kind: 'binding'; readonly path: string };

class ImageBuilder extends NodeBuilder<ImageNode> {
  private readonly content: ImageContent;

  constructor(content: ImageContent) { super(); this.content = content; }

  build(context: BuildContext): ImageNode {
    return {
      type: 'image',
      id: this.nodeId ?? context.idGenerator.next('image'),
      style: this.boxStyle,
      ...(this.content.kind === 'bitmap' ? { bitmap: this.content.value } : { binding: this.content.path }),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export const image = {
  bitmap(source: Bitmap): ImageBuilder { return new ImageBuilder({ kind: 'bitmap', value: source }); },
  binding(path: string): ImageBuilder { return new ImageBuilder({ kind: 'binding', path }); },
};
export type { ImageBuilder };

import type { VariableSegment } from '../content/Segment';
import type { ImageNode, ImageNodeSource, StaticImageSource } from '../nodes/ImageNode';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';

/** Builder của ảnh bitmap. */
export class ImageBuilder extends NodeBuilder<ImageNode> {
  private readonly source: ImageNodeSource;

  constructor(source: ImageNodeSource) {
    super();
    this.source = source;
  }

  build(context: BuildContext): ImageNode {
    return {
      type: 'image',
      id: this.resolveId(context, 'image'),
      ...this.visibilityField(),
      source: this.source,
      ...this.styleField(this.boxStyle),
    };
  }
}

/** Ảnh từ asset tĩnh (`{ asset: 'icon@v1' }`) hoặc từ biến kiểu `asset` (`scope.var('storeLogo')`). */
export function image(source: StaticImageSource | VariableSegment): ImageBuilder {
  // Ảnh không có format, nên chỉ giữ tên biến của segment.
  return new ImageBuilder('var' in source ? { var: source.var } : { asset: source.asset });
}

import type { BarcodeSymbology } from '../../symbology';
import type { Segment } from '../content/Segment';
import type { BarcodeNode } from '../nodes/BarcodeNode';
import type { Length } from '../style/Length';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';
import { toSegments, type SegmentInput } from './segments';

/** Builder của mã vạch 1D. */
export class BarcodeBuilder extends NodeBuilder<BarcodeNode> {
  private readonly content: readonly Segment[];

  private readonly symbology: BarcodeSymbology;

  private readableValue?: boolean;

  private barHeightValue?: Length;

  constructor(content: SegmentInput, symbology: BarcodeSymbology) {
    super();
    this.content = toSegments(content);
    this.symbology = symbology;
  }

  /** In kèm chữ đọc được bên dưới vạch. */
  readable(value: boolean): this {
    this.readableValue = value;
    return this;
  }

  /** Chiều cao vạch. */
  barHeight(value: Length): this {
    this.barHeightValue = value;
    return this;
  }

  build(context: BuildContext): BarcodeNode {
    return {
      type: 'barcode',
      id: this.resolveId(context, 'barcode'),
      ...this.visibilityField(),
      content: this.content,
      symbology: this.symbology,
      ...(this.readableValue !== undefined ? { readable: this.readableValue } : {}),
      ...(this.barHeightValue !== undefined ? { barHeight: this.barHeightValue } : {}),
      ...this.styleField(this.boxStyle),
    };
  }
}

/** Mã vạch 1D với nội dung và loại mã vạch. */
export function barcode(content: SegmentInput, symbology: BarcodeSymbology): BarcodeBuilder {
  return new BarcodeBuilder(content, symbology);
}

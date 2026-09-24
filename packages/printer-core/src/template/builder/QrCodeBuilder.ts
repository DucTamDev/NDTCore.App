import type { QrErrorCorrectionLevel } from '../../symbology';
import type { Segment } from '../content/Segment';
import type { QrCodeNode } from '../nodes/QrCodeNode';
import type { Length } from '../style/Length';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';
import { toSegments, type SegmentInput } from './segments';

/** Builder của mã QR. */
export class QrCodeBuilder extends NodeBuilder<QrCodeNode> {
  private readonly content: readonly Segment[];

  private errorCorrectionValue?: QrErrorCorrectionLevel;

  private moduleSizeValue?: Length;

  constructor(content: SegmentInput) {
    super();
    this.content = toSegments(content);
  }

  errorCorrection(value: QrErrorCorrectionLevel): this {
    this.errorCorrectionValue = value;
    return this;
  }

  /** Cạnh 1 module (ô vuông) của QR. */
  moduleSize(value: Length): this {
    this.moduleSizeValue = value;
    return this;
  }

  build(context: BuildContext): QrCodeNode {
    return {
      type: 'qrcode',
      id: this.resolveId(context, 'qrcode'),
      ...this.visibilityField(),
      content: this.content,
      ...(this.errorCorrectionValue !== undefined ? { errorCorrection: this.errorCorrectionValue } : {}),
      ...(this.moduleSizeValue !== undefined ? { moduleSize: this.moduleSizeValue } : {}),
      ...this.styleField(this.boxStyle),
    };
  }
}

/** Mã QR với nội dung cho trước. */
export function qrcode(content: SegmentInput): QrCodeBuilder {
  return new QrCodeBuilder(content);
}

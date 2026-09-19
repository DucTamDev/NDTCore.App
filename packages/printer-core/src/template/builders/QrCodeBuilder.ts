import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { QrCodeNode } from '../nodes/QrCodeNode';
import type { QrErrorCorrectionLevel } from '../../qrcode';

type QrContent = { readonly kind: 'literal'; readonly value: string } | { readonly kind: 'binding'; readonly path: string };

class QrCodeBuilder extends NodeBuilder<QrCodeNode> {
  private readonly content: QrContent;
  private errorCorrectionValue?: QrErrorCorrectionLevel;

  constructor(content: QrContent) { super(); this.content = content; }

  errorCorrection(value: QrErrorCorrectionLevel): this { this.errorCorrectionValue = value; return this; }

  build(context: BuildContext): QrCodeNode {
    return {
      type: 'qrcode',
      id: this.nodeId ?? context.idGenerator.next('qrcode'),
      style: this.boxStyle,
      ...(this.content.kind === 'literal' ? { content: this.content.value } : { binding: this.content.path }),
      ...(this.errorCorrectionValue !== undefined ? { errorCorrection: this.errorCorrectionValue } : {}),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export const qrcode = {
  literal(value: string): QrCodeBuilder { return new QrCodeBuilder({ kind: 'literal', value }); },
  binding(path: string): QrCodeBuilder { return new QrCodeBuilder({ kind: 'binding', path }); },
};
export type { QrCodeBuilder };

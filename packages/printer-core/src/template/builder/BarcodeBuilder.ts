import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { BarcodeNode } from '../nodes/BarcodeNode';
import type { BarcodeSymbology } from '../../symbology/barcode';

type BarcodeContent = { readonly kind: 'literal'; readonly value: string } | { readonly kind: 'binding'; readonly path: string };

class BarcodeBuilder extends NodeBuilder<BarcodeNode> {
  private readonly content: BarcodeContent;
  private symbologyValue?: BarcodeSymbology;
  private readableValue?: boolean;

  constructor(content: BarcodeContent) { super(); this.content = content; }

  symbology(value: BarcodeSymbology): this { this.symbologyValue = value; return this; }
  readable(value: boolean): this { this.readableValue = value; return this; }

  build(context: BuildContext): BarcodeNode {
    if (!this.symbologyValue) throw new Error('Barcode node requires .symbology(...)');
    return {
      type: 'barcode',
      id: this.nodeId ?? context.idGenerator.next('barcode'),
      symbology: this.symbologyValue,
      style: this.boxStyle,
      ...(this.content.kind === 'literal' ? { content: this.content.value } : { binding: this.content.path }),
      ...(this.readableValue !== undefined ? { readable: this.readableValue } : {}),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export const barcode = {
  literal(value: string): BarcodeBuilder { return new BarcodeBuilder({ kind: 'literal', value }); },
  binding(path: string): BarcodeBuilder { return new BarcodeBuilder({ kind: 'binding', path }); },
};
export type { BarcodeBuilder };

import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';
import type { BarcodeSymbology } from '../../symbology/barcode';

export interface BarcodeNode extends TemplateNodeBase {
  readonly type: 'barcode';
  readonly content?: string;
  readonly binding?: string;
  readonly symbology: BarcodeSymbology;
  readonly readable?: boolean;
  readonly style?: BoxStyle;
}

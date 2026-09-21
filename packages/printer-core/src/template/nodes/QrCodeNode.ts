import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';
import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';

export interface QrCodeNode extends TemplateNodeBase {
  readonly type: 'qrcode';
  readonly content?: string;
  readonly binding?: string;
  readonly errorCorrection?: QrErrorCorrectionLevel;
  readonly style?: BoxStyle;
}

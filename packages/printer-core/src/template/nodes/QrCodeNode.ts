import type { QrErrorCorrectionLevel } from '../../symbology';
import type { Segment } from '../content/Segment';
import type { BoxStyle } from '../style/BoxStyle';
import type { Length } from '../style/Length';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Mã QR. */
export interface QrCodeNode extends TemplateNodeBase {
  readonly type: 'qrcode';

  /** Dữ liệu mã hoá: các segment ghép liền nhau. */
  readonly content: readonly Segment[];

  /** Mức sửa lỗi; mặc định theo máy in. */
  readonly errorCorrection?: QrErrorCorrectionLevel;

  /** Cạnh 1 module (ô vuông) của QR; mặc định theo máy in. */
  readonly moduleSize?: Length;

  /** Style hộp. */
  readonly style?: BoxStyle;
}

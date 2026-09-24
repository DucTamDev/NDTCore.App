import type { BarcodeSymbology } from '../../symbology';
import type { Segment } from '../content/Segment';
import type { BoxStyle } from '../style/BoxStyle';
import type { Length } from '../style/Length';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Mã vạch 1D. */
export interface BarcodeNode extends TemplateNodeBase {
  readonly type: 'barcode';

  /** Dữ liệu mã hoá: các segment ghép liền nhau. */
  readonly content: readonly Segment[];

  /** Loại mã vạch, VD `code128`. */
  readonly symbology: BarcodeSymbology;

  /** In kèm chữ đọc được bên dưới vạch; mặc định theo máy in. */
  readonly readable?: boolean;

  /** Chiều cao vạch; mặc định theo máy in. */
  readonly barHeight?: Length;

  /** Style hộp. */
  readonly style?: BoxStyle;
}

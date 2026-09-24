import type { BoxStyle } from '../style/BoxStyle';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Ảnh tĩnh thuộc thiết kế template (icon, hoa văn), tham chiếu bằng mã asset có version. */
export interface StaticImageSource {
  /** Mã asset, VD `icon-cup@v2`. */
  readonly asset: string;
}

/** Ảnh lấy từ 1 biến kiểu `asset` của catalog (VD logo cửa hàng). */
export interface VariableImageSource {
  /** Tên biến kiểu `asset`. */
  readonly var: string;
}

/** Nguồn ảnh: chỉ lưu mã asset, không lưu dữ liệu ảnh. */
export type ImageNodeSource = StaticImageSource | VariableImageSource;

/** Ảnh bitmap, tra qua `AssetProvider` lúc resolve. */
export interface ImageNode extends TemplateNodeBase {
  readonly type: 'image';

  /** Nguồn ảnh: asset tĩnh hoặc biến catalog. */
  readonly source: ImageNodeSource;

  /** Style hộp. */
  readonly style?: BoxStyle;
}

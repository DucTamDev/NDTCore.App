import type { BarcodeSymbology, QrErrorCorrectionLevel } from '../symbology';
import type { BoxStyle, LayoutStyle, Length, LinePattern, TextStyle } from '../template';
import type { Bitmap } from '../types';

/** Node sau khi resolve: giá trị đã thành chuỗi, kích thước vẫn là `Length` (Layout mới đổi sang dots). */
export type ResolvedNode =
  | ResolvedContainer
  | ResolvedText
  | ResolvedLine
  | ResolvedBarcode
  | ResolvedQrCode
  | ResolvedImage;

/** Container; `repeat` cũng resolve thành container chứa các bản lặp. */
export interface ResolvedContainer {
  readonly type: 'container';

  readonly id: string;

  /** Style bố cục; bỏ trống dùng mặc định của layout. */
  readonly style?: LayoutStyle;

  readonly children: readonly ResolvedNode[];
}

/** Đoạn chữ đã ghép + format xong. */
export interface ResolvedText {
  readonly type: 'text';

  readonly id: string;

  /** Chuỗi cần in. */
  readonly value: string;

  /** Style khung + chữ; bỏ trống dùng mặc định của layout. */
  readonly style?: BoxStyle & TextStyle;
}

/** Đường kẻ ngang. */
export interface ResolvedLine {
  readonly type: 'line';

  readonly id: string;

  /** Độ dày nét; bỏ trống là mặc định của máy in. */
  readonly thickness?: Length;

  /** Kiểu nét: liền hoặc đứt. */
  readonly pattern: LinePattern;

  /** Style khung; bỏ trống dùng mặc định của layout. */
  readonly style?: BoxStyle;
}

/** Mã vạch 1D. */
export interface ResolvedBarcode {
  readonly type: 'barcode';

  readonly id: string;

  /** Dữ liệu mã hoá. */
  readonly value: string;

  /** Loại mã vạch, VD `code128`. */
  readonly symbology: BarcodeSymbology;

  /** In kèm chữ đọc được. */
  readonly readable?: boolean;

  /** Chiều cao vạch. */
  readonly barHeight?: Length;

  /** Style khung; bỏ trống dùng mặc định của layout. */
  readonly style?: BoxStyle;
}

/** Mã QR. */
export interface ResolvedQrCode {
  readonly type: 'qrcode';

  readonly id: string;

  /** Dữ liệu mã hoá. */
  readonly value: string;

  /** Mức sửa lỗi; bỏ trống là mặc định của máy in. */
  readonly errorCorrection?: QrErrorCorrectionLevel;

  /** Cạnh 1 module. */
  readonly moduleSize?: Length;

  /** Style khung; bỏ trống dùng mặc định của layout. */
  readonly style?: BoxStyle;
}

/** Ảnh đã tra được bitmap từ `AssetProvider`. */
export interface ResolvedImage {
  readonly type: 'image';

  readonly id: string;

  /** Bitmap 1-bit; mỗi pixel là 1 dot khi in. */
  readonly bitmap: Bitmap;

  /** Style khung; bỏ trống dùng mặc định của layout. */
  readonly style?: BoxStyle;
}

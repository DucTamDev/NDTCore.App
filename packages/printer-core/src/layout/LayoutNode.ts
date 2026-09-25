import type { BarcodeSymbology, QrErrorCorrectionLevel } from '../symbology';
import type { Bitmap } from '../types';

/** Khoảng cách 4 cạnh, dots. */
export interface LayoutInsets {
  /** Khoảng cách cạnh trên, dots. */
  readonly top: number;

  /** Khoảng cách cạnh phải, dots. */
  readonly right: number;

  /** Khoảng cách cạnh dưới, dots. */
  readonly bottom: number;

  /** Khoảng cách cạnh trái, dots. */
  readonly left: number;
}

/** Kích thước đã đổi sang dots; `fixed.value` tính bằng dots. */
export type LayoutDimension =
  | { readonly type: 'fixed'; readonly value: number }
  | { readonly type: 'fill' }
  | { readonly type: 'auto' };

/** Style hộp, mọi độ dài tính bằng dots. */
export interface LayoutBoxStyle {
  /** Chiều rộng, dots; bỏ trống là `auto`. */
  readonly width?: LayoutDimension;

  /** Chiều cao, dots; bỏ trống là `auto`. */
  readonly height?: LayoutDimension;

  /** Khoảng cách bên ngoài hộp, dots. */
  readonly margin?: LayoutInsets;

  /** Khoảng cách bên trong hộp, giữa viền và nội dung, dots. */
  readonly padding?: LayoutInsets;
}

/** Style container, mọi độ dài tính bằng dots. */
export interface LayoutContainerStyle extends LayoutBoxStyle {
  /** Hướng xếp node con; mặc định `column`. */
  readonly direction?: 'row' | 'column';

  /** Khoảng cách giữa 2 node con, dots. */
  readonly gap?: number;

  /** Phân bố node con theo trục chính; mặc định `start`. */
  readonly justifyContent?: 'start' | 'center' | 'end' | 'space-between';

  /** Căn node con theo trục phụ; mặc định `start`. */
  readonly alignItems?: 'start' | 'center' | 'end';
}

/** Style chữ đã đổi sang dots — đầu vào của `FontMetrics`. */
export interface LayoutTextStyle extends LayoutBoxStyle {
  /** Cỡ chữ, dots. */
  readonly fontSize?: number;

  /** Độ đậm; mặc định `normal`. */
  readonly fontWeight?: 'normal' | 'bold';

  /** Chiều cao cả dòng, dots (đã nhân hệ số `lineHeight` của template với cỡ chữ). */
  readonly lineHeight?: number;

  /** Căn lề ngang; mặc định `left`. */
  readonly textAlign?: 'left' | 'center' | 'right';
}

/** Cấu hình nét đứt, dots. */
export interface LayoutDash {
  /** Độ dài 1 đoạn nét, dots. */
  readonly dashDots: number;

  /** Khoảng trống giữa 2 đoạn, dots. */
  readonly gapDots: number;
}

/** Node đã đổi mọi độ dài sang dots theo DPI máy in đích — đầu vào của thuật toán layout. */
export type LayoutNode = LayoutContainer | LayoutText | LayoutLine | LayoutBarcode | LayoutQrCode | LayoutImage;

/** Container; mọi độ dài trong style đã đổi sang dots. */
export interface LayoutContainer {
  readonly type: 'container';

  readonly id: string;

  /** Style bố cục, đã đổi sang dots; bỏ trống dùng mặc định của layout. */
  readonly style?: LayoutContainerStyle;

  /** Danh sách node con. */
  readonly children: readonly LayoutNode[];
}

/** Đoạn chữ cần in; mọi kích thước trong style đã đổi sang dots. */
export interface LayoutText {
  readonly type: 'text';

  readonly id: string;

  /** Chuỗi cần in. */
  readonly value: string;

  /** Style khung + chữ, đã đổi sang dots. */
  readonly style: LayoutTextStyle;
}

/** Đường kẻ ngang; đã đổi sang dots, có thể là nét đứt (`dash`). */
export interface LayoutLine {
  readonly type: 'line';

  readonly id: string;

  /** Độ dày nét, dots; bỏ trống là mặc định của máy in. */
  readonly thickness?: number;

  /** Có giá trị khi là nét đứt. */
  readonly dash?: LayoutDash;

  /** Style khung, đã đổi sang dots; bỏ trống dùng mặc định của layout. */
  readonly style?: LayoutBoxStyle;
}

/** Mã vạch 1D; kích thước đã đổi sang dots. */
export interface LayoutBarcode {
  readonly type: 'barcode';

  readonly id: string;

  /** Dữ liệu mã hoá. */
  readonly value: string;

  /** Loại mã vạch, VD `code128`. */
  readonly symbology: BarcodeSymbology;

  /** In kèm chữ đọc được. */
  readonly readable?: boolean;

  /** Chiều cao vạch, dots. */
  readonly barHeight?: number;

  /** Style khung, đã đổi sang dots; bỏ trống dùng mặc định của layout. */
  readonly style?: LayoutBoxStyle;
}

/** Mã QR; kích thước đã đổi sang dots. */
export interface LayoutQrCode {
  readonly type: 'qrcode';

  readonly id: string;

  /** Dữ liệu mã hoá. */
  readonly value: string;

  /** Mức sửa lỗi; bỏ trống là mặc định của máy in. */
  readonly errorCorrection?: QrErrorCorrectionLevel;

  /** Cạnh 1 module, dots. */
  readonly moduleSize?: number;

  /** Style khung, đã đổi sang dots; bỏ trống dùng mặc định của layout. */
  readonly style?: LayoutBoxStyle;
}

/** Ảnh; bitmap mỗi pixel là 1 dot. */
export interface LayoutImage {
  readonly type: 'image';

  readonly id: string;

  /** Bitmap; mỗi pixel là 1 dot. */
  readonly bitmap: Bitmap;

  /** Style khung, đã đổi sang dots; bỏ trống dùng mặc định của layout. */
  readonly style?: LayoutBoxStyle;
}

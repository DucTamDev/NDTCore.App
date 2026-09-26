/** Loại dao cắt giấy của máy in. */
export type CutterType = 'none' | 'partial' | 'full';

/** Cách máy in nhận dữ liệu ảnh. */
export type ImageMode = 'raster' | 'column' | 'nvGraphics';

/** Năng lực của máy in đích mà compiler có thể dựa vào; field bỏ trống là chưa biết, compiler dùng mặc định. */
export interface PrinterFeatures {
  /** Loại dao cắt giấy; `'none'` là máy không có dao cắt. */
  cutter?: CutterType;

  /** Máy có cổng mở ngăn kéo đựng tiền. */
  cashDrawer?: boolean;

  /** Các cách nhận dữ liệu ảnh máy in hỗ trợ. */
  imageMode?: ImageMode[];

  /** Máy in có font chữ CJK (Trung, Nhật, Hàn). */
  cjk?: boolean;

  /** Máy in nhận thẳng UTF-8, không cần đổi chữ sang code page. */
  nativeUtf8?: boolean;

  /** Code page máy in hỗ trợ, theo số hiệu code page (VD 437, 1258). */
  codePages?: number[];
}

export const PrinterDriverType = {
  EscPos: 'EscPos',
  Tspl: 'Tspl',
} as const;

export type PrinterDriverType = (typeof PrinterDriverType)[keyof typeof PrinterDriverType];

export const DriverSource = {
  Auto: 'Auto',
  Manual: 'Manual',
} as const;

export type DriverSource = (typeof DriverSource)[keyof typeof DriverSource];

/**
 * Chiến lược render dùng chung cho CẢ 2 protocol. TSPL chỉ còn `Bitmap` (đã
 * bỏ TrueType/internal-font — enforce ở schema, không phải ở type vì cả 2
 * driver dùng chung 1 `PrinterDriverConfig`). ESC/POS chọn `Encoder` hoặc `Bitmap`.
 */
export const RenderMode = {
  /** ESC/POS only — encode trực tiếp qua `EPToolkit` (cần đúng codepage CP1258), không rasterize. */
  Encoder: 'Encoder',
  /** Render nội dung thành ảnh rồi gửi lệnh bitmap của protocol. Chậm hơn `Encoder` nhưng đúng trên mọi máy bất kể codepage. */
  Bitmap: 'Bitmap',
} as const;

export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];

/**
 * Chỉ có ý nghĩa khi `renderMode === Bitmap` — chọn nguồn tạo ra
 * `documents.image`. `Image` (mặc định, backward-compat) là chụp `View` qua
 * `react-native-view-shot`; `Ast` vẽ trực tiếp từ `PrintDocument.elements[]`
 * lên canvas Skia off-screen, không mount View.
 */
export const BitmapSource = {
  Image: 'Image',
  Ast: 'Ast',
} as const;

export type BitmapSource = (typeof BitmapSource)[keyof typeof BitmapSource];

export interface PrinterDriverConfig {
  renderMode: RenderMode;
  /** Chỉ có ý nghĩa khi renderMode === Bitmap. Thiếu field (printer lưu trước khi field này tồn tại) coi như `Image`. */
  bitmapSource?: BitmapSource;
}

/** 1 driver (protocol) của 1 `Printer` — mỗi `Printer` có ĐÚNG 1 driver, xem `Printer.ts`. */
export interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  config: PrinterDriverConfig;
}

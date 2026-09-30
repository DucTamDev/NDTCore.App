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
 * Chiến lược render dùng chung cho CẢ 2 protocol — cả TSPL và ESC/POS đều
 * chọn được `Encoder` hoặc `Bitmap` (trước đây TSPL chỉ có `Bitmap`, đã bỏ
 * giới hạn này khi thêm `TsplTextStrategy`). Ý nghĩa `Encoder` khác nhau theo
 * protocol — xem chi tiết ở từng nhánh bên dưới.
 */
export const RenderMode = {
  /**
   * Encode trực tiếp thành lệnh text của protocol, không rasterize — nhanh
   * hơn `Bitmap` nhưng phụ thuộc font/codepage của máy in:
   * - TSPL (`TsplTextStrategy`): dùng font built-in `"3"` sẵn có trên máy,
   *   chủ yếu chỉ có glyph ASCII — có thể không hiện đúng dấu tiếng Việt trên
   *   một số dòng máy (xem comment `TsplEncoder.text()`).
   * - ESC/POS: encode qua `EPToolkit`, cần cấu hình đúng codepage (CP1258)
   *   để hiện đúng tiếng Việt.
   */
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

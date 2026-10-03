/** Ngôn ngữ lệnh của máy in. */
export const PrintLanguage = {
  EscPos: 'EscPos',
  Tspl: 'Tspl',
} as const;

export type PrintLanguage = (typeof PrintLanguage)[keyof typeof PrintLanguage];

/** Ngôn ngữ được xác định tự động (dò) hay do người dùng chọn. */
export const LanguageSelection = {
  Auto: 'Auto',
  Manual: 'Manual',
} as const;

export type LanguageSelection = (typeof LanguageSelection)[keyof typeof LanguageSelection];

/** Cách biến nội dung thành lệnh in. */
export const RenderMode = {
  /** Gửi lệnh văn bản của ngôn ngữ; nhanh, phụ thuộc font/codepage của máy. */
  Command: 'Command',

  /** Gửi nội dung dưới dạng ảnh; chậm hơn, đúng trên mọi máy. */
  Raster: 'Raster',
} as const;

export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];

/** Nguồn tạo ảnh khi in `Raster`. */
export const RasterSource = {
  /** Chụp màn hình bản xem trước. */
  Image: 'Image',

  /** Vẽ trực tiếp từ `PrintDocument` lên canvas, không cần màn hình. */
  Ast: 'Ast',
} as const;

export type RasterSource = (typeof RasterSource)[keyof typeof RasterSource];

/** Cấu hình ngôn ngữ in của một máy in. */
export interface PrinterLanguage {
  /** Ngôn ngữ lệnh mà máy in sử dụng. */
  type: PrintLanguage;

  /** Cách xác định ngôn ngữ; chỉ để hiển thị. */
  selection: LanguageSelection;

  renderMode: RenderMode;

  /** Chỉ có tác dụng khi `renderMode` là `Raster`. */
  rasterSource: RasterSource;
}

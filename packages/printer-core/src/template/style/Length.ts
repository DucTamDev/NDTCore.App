/** Đơn vị độ dài trong template: `mm` = 1/25.4 inch, `pt` = 1/72 inch, `px` = 1/96 inch (pixel chuẩn CSS). */
export type LengthUnit = 'mm' | 'pt' | 'px';

/** Độ dài vật lý, độc lập DPI — tầng Layout mới đổi sang dots theo máy in đích. */
export interface Length {
  /** Giá trị số, giữ nguyên như người viết khai báo (không quy đổi lúc lưu). */
  readonly value: number;

  /** Đơn vị độ dài. */
  readonly unit: LengthUnit;
}

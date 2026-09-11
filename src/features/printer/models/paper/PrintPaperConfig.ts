export const PaperSize = {
  Mm58: 58,
  Mm80: 80,
  Mm100: 100,
  Mm104: 104,
} as const;

export type PaperSize =
  (typeof PaperSize)[keyof typeof PaperSize];

export const PrintPaperType = {
  /** Giấy cuộn liên tục, không có khe giữa các tem. */
  Continuous: 'Continuous',

  /** Giấy tem rời, có khe giữa các tem. */
  DieCut: 'DieCut',
} as const;

export type PrintPaperType =
  (typeof PrintPaperType)[keyof typeof PrintPaperType];

export const CutterMode = {
  None: 'None',

  /** Cắt một lần sau khi hoàn thành toàn bộ job in. */
  PerJob: 'PerJob',

  /** Cắt sau mỗi hàng in. */
  PerRow: 'PerRow',
} as const;

export type CutterMode =
  (typeof CutterMode)[keyof typeof CutterMode];

/**
 * Cấu hình loại giấy và bố cục giấy được sử dụng bởi printer driver.
 *
 * Với giấy die-cut, các thông tin kích thước tem, số cột và khoảng cách
 * giữa các tem được sử dụng để xác định bố cục in.
 *
 * Quy tắc cutter được kiểm tra riêng tại paper/cutter.
 */
export interface PrintPaperConfig {
  type: PrintPaperType;
  paperSize: PaperSize;
  itemWidthMm?: number;
  itemHeightMm?: number;
  columns?: number;
  horizontalGapMm?: number;
  verticalGapMm?: number;
  cutterMode?: CutterMode;
}

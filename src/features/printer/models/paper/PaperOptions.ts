/** Khổ giấy (mm). */
export const PaperSize = {
  Mm58: 58,
  Mm80: 80,
  Mm100: 100,
  Mm104: 104,
} as const;

export type PaperSize = (typeof PaperSize)[keyof typeof PaperSize];

/** Giấy cuộn liên tục hay giấy tem rời có khe. */
export const PaperType = {
  /** Giấy cuộn liên tục, không có khe giữa các tem. */
  Continuous: 'Continuous',

  /** Giấy tem rời, có khe giữa các tem. */
  DieCut: 'DieCut',
} as const;

export type PaperType = (typeof PaperType)[keyof typeof PaperType];

/** Thời điểm cắt giấy. */
export const CutterMode = {
  None: 'None',

  /** Cắt một lần sau khi in xong cả job. */
  PerJob: 'PerJob',

  /** Cắt sau mỗi hàng in. */
  PerRow: 'PerRow',
} as const;

export type CutterMode = (typeof CutterMode)[keyof typeof CutterMode];

/** Cấu hình giấy của một máy in; các field kích thước tem chỉ có nghĩa với giấy tem. */
export interface PaperOptions {
  type: PaperType;

  paperSize: PaperSize;

  /** Chiều rộng một con tem (mm). */
  itemWidthMm?: number;

  /** Chiều cao một con tem (mm). */
  itemHeightMm?: number;

  /** Số con tem trên một hàng. */
  columns?: number;

  /** Khe giữa hai con tem cạnh nhau (mm). */
  horizontalGapMm?: number;

  /** Khe giữa hai hàng tem (mm). */
  verticalGapMm?: number;

  cutterMode?: CutterMode;
}

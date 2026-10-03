

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

/** Giấy cuộn liên tục. */
export interface ContinuousPaper {
  type: typeof PaperType.Continuous;

  paperSize: PaperSize;

  cutterMode: CutterMode;
}

/** Giấy tem rời; tách bằng răng cưa nên không cắt. */
export interface DieCutPaper {
  type: typeof PaperType.DieCut;

  paperSize: PaperSize;

  /** Chiều rộng một con tem (mm). */
  itemWidthMm: number;

  /** Chiều cao một con tem (mm). */
  itemHeightMm: number;

  /** Số con tem trên một hàng. */
  columns: number;

  /** Khe giữa hai con tem cạnh nhau (mm). */
  horizontalGapMm: number;

  /** Khe giữa hai hàng tem (mm). */
  verticalGapMm: number;
}

/** Cấu hình giấy của một máy in. */
export type PaperOptions = ContinuousPaper | DieCutPaper;

/** Cách cắt thực tế: giấy tem tách bằng răng cưa nên không bao giờ cắt; giấy cuộn theo cấu hình. */
export const resolveEffectiveCutterMode = (paper: PaperOptions): CutterMode =>
  paper.type === PaperType.DieCut ? CutterMode.None : paper.cutterMode;

/** Giấy cuộn liên tục hay giấy tem rời có khe. */
export const PaperType = {
  /** Giấy cuộn liên tục, không có khe giữa các tem. */
  Continuous: 'Continuous',

  /** Giấy tem rời, có khe giữa các tem. */
  DieCut: 'DieCut',
} as const;

export type PaperType = (typeof PaperType)[keyof typeof PaperType];

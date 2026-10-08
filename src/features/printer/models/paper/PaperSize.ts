/** Khổ giấy (mm). */
export const PaperSize = {
  Mm58: 58,
  Mm80: 80,
  Mm100: 100,
  Mm104: 104,
} as const;

export type PaperSize = (typeof PaperSize)[keyof typeof PaperSize];

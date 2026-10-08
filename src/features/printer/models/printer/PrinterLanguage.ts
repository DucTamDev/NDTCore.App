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

/** Cấu hình ngôn ngữ in của một máy in. */
export interface PrinterLanguage {
  /** Ngôn ngữ lệnh mà máy in sử dụng. */
  type: PrintLanguage;

  /** Cách xác định ngôn ngữ; chỉ để hiển thị. */
  selection: LanguageSelection;
}

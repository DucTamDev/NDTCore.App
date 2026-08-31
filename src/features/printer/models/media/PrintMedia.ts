export type PaperSize = 58 | 80 | 100 | 104;

export const PrintMediaType = {
  /** Giấy cuộn liên tục — không khe/răng cưa vật lý. */
  continuous: 'continuous',
  /** Giấy tem rời có khe (die-cut / pre-cut), có thể nhiều cột. */
  dieCut: 'die_cut',
} as const;
export type PrintMediaType = (typeof PrintMediaType)[keyof typeof PrintMediaType];

export const CutterMode = {
  none: 'none',
  /** Cắt 1 lần sau khi in xong cả job. */
  perJob: 'per_job',
  /** Cắt sau mỗi hàng in liên tiếp. */
  perRow: 'per_row',
} as const;
export type CutterMode = (typeof CutterMode)[keyof typeof CutterMode];

/**
 * Loại giấy + layout của 1 driver. Độc lập với `PrintType` và `PrinterDriverType`
 * — cùng 1 loại nội dung in được trên cả continuous lẫn die-cut. Các field
 * `itemWidthMm`/`itemHeightMm`/`columns`/gap chỉ có nghĩa (và schema bắt buộc)
 * khi `type === 'die_cut'`.
 */
export interface PrintMedia {
  type: PrintMediaType;
  paperSize: PaperSize;
  itemWidthMm?: number;
  itemHeightMm?: number;
  columns?: number;
  horizontalGapMm?: number;
  verticalGapMm?: number;
  /** die_cut ⇒ luôn `'none'`; continuous + `undefined` ⇒ `'per_job'`. Áp ràng buộc ở `media/cutter.ts`. */
  cutterMode?: CutterMode;
}

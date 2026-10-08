/** Thời điểm cắt giấy. */
export const CutterMode = {
  None: 'None',

  /** Cắt một lần sau khi in xong cả job. */
  PerJob: 'PerJob',

  /** Cắt sau mỗi hàng in. */
  PerRow: 'PerRow',
} as const;

export type CutterMode = (typeof CutterMode)[keyof typeof CutterMode];

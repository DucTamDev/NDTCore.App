/** Kết quả tổng của một yêu cầu in. */
export const PrintResultStatus = {
  /** Mọi máy in đều in xong. */
  Success: 'Success',

  /** Một số máy in xong, một số lỗi. */
  PartialFailure: 'PartialFailure',

  /** Mọi máy đều lỗi. */
  Failed: 'Failed',

  /** Không có máy in nào nhận loại nội dung này. */
  NoAvailablePrinter: 'NoAvailablePrinter',
} as const;

export type PrintResultStatus = (typeof PrintResultStatus)[keyof typeof PrintResultStatus];

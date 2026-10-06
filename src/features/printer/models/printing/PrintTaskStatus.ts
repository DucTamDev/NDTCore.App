/** Trạng thái một lệnh in trong hàng đợi. */
export const PrintTaskStatus = {
  /** Đang chờ tới lượt. */
  Pending: 'Pending',

  /** Đang gửi tới máy in. */
  Printing: 'Printing',

  /** Máy in đã nhận đủ dữ liệu. */
  Success: 'Success',

  /** Gửi thất bại; xem `PrintTask.error`. */
  Failed: 'Failed',

  /** Bị huỷ trước khi in xong. */
  Cancelled: 'Cancelled',
} as const;

export type PrintTaskStatus = (typeof PrintTaskStatus)[keyof typeof PrintTaskStatus];

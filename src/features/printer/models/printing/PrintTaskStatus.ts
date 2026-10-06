/** Kết quả của một lệnh in. */
export const PrintTaskStatus = {
  /** Máy in đã nhận đủ dữ liệu. */
  Success: 'Success',

  /** Gửi thất bại; xem `PrintTaskResult.error`. */
  Failed: 'Failed',
} as const;

export type PrintTaskStatus = (typeof PrintTaskStatus)[keyof typeof PrintTaskStatus];

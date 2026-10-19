/** Kết quả đưa một yêu cầu in vào hàng đợi; kết quả in thật đến sau qua `PrintQueue.onTaskFinished`. */
export const PrintEnqueueStatus = {
  /** Đã đưa lệnh vào hàng đợi của mọi máy nhận loại nội dung này. */
  Queued: 'Queued',

  /** Không có máy in nào nhận loại nội dung này; không chụp, không có lệnh nào. */
  NoAvailablePrinter: 'NoAvailablePrinter',

  /** Chụp nội dung hỏng; không có lệnh nào vào hàng đợi. */
  CaptureFailed: 'CaptureFailed',
} as const;

export type PrintEnqueueStatus = (typeof PrintEnqueueStatus)[keyof typeof PrintEnqueueStatus];

/** Trạng thái kết nối của một máy in trong phiên chạy hiện tại; không lưu. */
export const PrinterConnectionStatus = {
  /** Chưa từng kết nối trong phiên này. */
  Idle: 'Idle',

  /** Đang mở kết nối. */
  Connecting: 'Connecting',

  /** Đã kết nối, gửi lệnh in được. */
  Connected: 'Connected',

  /** Đang đóng kết nối. */
  Disconnecting: 'Disconnecting',

  /** Đã ngắt (chủ động hoặc mất kết nối). */
  Disconnected: 'Disconnected',

  /** Đang kết nối lại. */
  Reconnecting: 'Reconnecting',

  /** Kết nối hoặc ngắt thất bại. */
  Error: 'Error',
} as const;

export type PrinterConnectionStatus = (typeof PrinterConnectionStatus)[keyof typeof PrinterConnectionStatus];

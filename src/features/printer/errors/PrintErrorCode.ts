/**
 * Mã lỗi liên quan đến print request, print job hoặc print pipeline.
 *
 * Các lỗi ở tầng device như connection hoặc write không được
 * định nghĩa lại ở đây mà sử dụng DeviceErrorCode.
 */
export const PrintErrorCode = {
  /** Không có printer khả dụng cho print request. */
  NO_AVAILABLE_PRINTER: 'NO_AVAILABLE_PRINTER',

  /** Dữ liệu ảnh không hợp lệ hoặc không thể đọc được. */
  INVALID_IMAGE: 'INVALID_IMAGE',

  /** Kích thước ảnh vượt quá giới hạn được hỗ trợ. */
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',

  /** Không thể encode nội dung theo print protocol của printer. */
  ENCODE_FAILED: 'ENCODE_FAILED',

  /** Nội dung cần in không được print pipeline hỗ trợ. */
  UNSUPPORTED_CONTENT: 'UNSUPPORTED_CONTENT',

  /** Print request hoặc print job đã bị huỷ trước khi hoàn thành. */
  CANCELLED: 'CANCELLED',

  /** Xảy ra lỗi không xác định trong quá trình in. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type PrintErrorCode = (typeof PrintErrorCode)[keyof typeof PrintErrorCode];

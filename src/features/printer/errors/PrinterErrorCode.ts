/**
 * Mã lỗi liên quan đến cấu hình và việc tìm printer.
 *
 * Các lỗi này thuộc tầng printer/application, không phải lỗi
 * thiết bị vật lý hoặc I/O của connection.
 */
export const PrinterErrorCode = {
  /** Cấu hình printer không hợp lệ. */
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  /** Không tìm thấy printer theo định danh được yêu cầu. */
  PRINTER_NOT_FOUND: 'PRINTER_NOT_FOUND',

  /** Đã tồn tại printer có cùng identity. */
  PRINTER_ALREADY_EXISTS: 'PRINTER_ALREADY_EXISTS',

  /** Printer không xác định được print protocol. */
  PRINTER_PROTOCOL_UNKNOWN: 'PRINTER_PROTOCOL_UNKNOWN',

  /** Printer sử dụng kiểu connection không được hỗ trợ. */
  PRINTER_UNSUPPORTED_CONNECTION: 'PRINTER_UNSUPPORTED_CONNECTION',
} as const;

export type PrinterErrorCode = (typeof PrinterErrorCode)[keyof typeof PrinterErrorCode];

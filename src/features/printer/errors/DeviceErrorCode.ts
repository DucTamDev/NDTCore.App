/**
 * Mã lỗi được trả về từ tầng thiết bị native.
 *
 * Các mã này phải khớp 1:1 với DeviceErrorCode ở native.
 * Tầng device chỉ xử lý thiết bị vật lý và connection;
 * không biết về printer, print job hoặc print protocol.
 */
export const DeviceErrorCode = {
  /** Tham số truyền vào không hợp lệ hoặc bị thiếu. */
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',

  /** Không tìm thấy thiết bị phù hợp. */
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',

  /** Có nhiều thiết bị phù hợp và không thể xác định duy nhất một thiết bị. */
  AMBIGUOUS_DEVICE: 'AMBIGUOUS_DEVICE',

  /** Không được cấp quyền truy cập thiết bị. */
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  /** Bluetooth đang bị tắt trên thiết bị. */
  BLUETOOTH_DISABLED: 'BLUETOOTH_DISABLED',

  /** Không thể thiết lập connection với thiết bị. */
  CONNECTION_FAILED: 'CONNECTION_FAILED',

  /** Thao tác yêu cầu connection đang mở nhưng hiện không có. */
  NOT_CONNECTED: 'NOT_CONNECTED',

  /** Connection đã được thiết lập nhưng bị mất trong quá trình sử dụng. */
  CONNECTION_LOST: 'CONNECTION_LOST',

  /** Không thể ghi dữ liệu vào thiết bị. */
  WRITE_FAILED: 'WRITE_FAILED',

  /** Ghi dữ liệu vượt quá thời gian chờ cho phép. */
  WRITE_TIMEOUT: 'WRITE_TIMEOUT',

  /** Transport hoặc thiết bị không hỗ trợ đọc dữ liệu. */
  READ_NOT_SUPPORTED: 'READ_NOT_SUPPORTED',

  /** Không thể đọc dữ liệu từ thiết bị. */
  READ_FAILED: 'READ_FAILED',

  /** Device service đã bị đóng và không thể tiếp tục sử dụng. */
  SERVICE_CLOSED: 'SERVICE_CLOSED',
} as const;

export type DeviceErrorCode = (typeof DeviceErrorCode)[keyof typeof DeviceErrorCode];

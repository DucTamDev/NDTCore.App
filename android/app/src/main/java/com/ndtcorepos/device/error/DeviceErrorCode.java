package com.ndtcorepos.device.error;

/**
 * Mã lỗi của device layer.
 *
 * <p>Tên enum được dùng làm error code gửi sang JavaScript.
 * Device layer không biết printer, protocol hoặc print job.</p>
 */
public enum DeviceErrorCode {

    /** Argument truyền vào không hợp lệ. */
    INVALID_ARGUMENT,

    /** Không tìm thấy device phù hợp. */
    DEVICE_NOT_FOUND,

    /** Có nhiều device cùng thỏa điều kiện và không thể xác định một device duy nhất. */
    AMBIGUOUS_DEVICE,

    /** Chưa được cấp quyền truy cập device. */
    PERMISSION_DENIED,

    /** Bluetooth hiện đang bị tắt. */
    BLUETOOTH_DISABLED,

    /** Không thể thiết lập connection. */
    CONNECTION_FAILED,

    /** Thao tác yêu cầu một connection đang mở nhưng hiện không có. */
    NOT_CONNECTED,

    /** Connection đã bị mất sau khi kết nối thành công. */
    CONNECTION_LOST,

    /** Không thể ghi dữ liệu vào device. */
    WRITE_FAILED,

    /** Ghi dữ liệu vượt quá thời gian cho phép. */
    WRITE_TIMEOUT,

    /** Transport/device không hỗ trợ đọc dữ liệu. */
    READ_NOT_SUPPORTED,

    /** Đọc dữ liệu thất bại. */
    READ_FAILED,

    /** Device service đã bị đóng và không thể tiếp tục sử dụng. */
    SERVICE_CLOSED
}

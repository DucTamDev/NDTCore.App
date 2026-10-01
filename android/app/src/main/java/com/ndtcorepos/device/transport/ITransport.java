package com.ndtcorepos.device.transport;

import com.ndtcorepos.device.error.DeviceException;

/**
 * Truyền byte trên một đường truyền. Mọi hạn (`deadlineNanos`) là mốc tuyệt đối theo `System.nanoTime()` để không
 * lệch khi đồng hồ hệ thống đổi, và để một lần ghi nhiều khúc không cộng dồn timeout.
 */
public interface ITransport {

    void open() throws DeviceException;

    /** Ghi đủ toàn bộ `data`, hoặc ném `WRITE_TIMEOUT`/`WRITE_FAILED` kèm số byte của các khúc đã ghi xong. */
    void write(byte[] data, long deadlineNanos) throws DeviceException;

    /** Trả ngay khi có ít nhất 1 byte (tối đa `maxBytes`); hết hạn mà chưa có byte → mảng rỗng. */
    byte[] read(int maxBytes, long deadlineNanos) throws DeviceException;

    /** Đóng bình thường, gọi khi không còn thao tác nào đang chạy; được phép chờ dữ liệu cuối gửi xong. */
    void close();

    /** Cắt ngay, không chờ; gọi được từ luồng khác để giải phóng lần ghi/đọc đang kẹt. Gọi nhiều lần không sao. */
    void abort();

    /** Còn dùng được không, kể cả sau một lỗi. */
    boolean isOpen();

    /** Địa chỉ phần cứng (đường dẫn USB, MAC, host:port) để tạo `connectionId` và khớp sự kiện mất kết nối. */
    String hardwareAddress();

    /** Serial đọc từ thiết bị; `null` nếu không có hoặc đường truyền không hỗ trợ. */
    String serialNumber();
}

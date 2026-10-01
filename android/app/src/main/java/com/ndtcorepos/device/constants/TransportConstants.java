package com.ndtcorepos.device.constants;

/** Thông số truyền byte của các transport, gom một chỗ để chỉnh theo phần cứng thực tế. */
public final class TransportConstants {

    /** Một lần bulkTransfer lớn hơn mức này bị một số kernel Android từ chối ngay. */
    public static final int USB_CHUNK_SIZE_BYTES = 16_384;

    /** Khúc ghi Bluetooth/LAN trước mỗi lần `flush`; khúc nhỏ để đếm được số byte đã gửi khi bị cắt ngang. */
    public static final int STREAM_CHUNK_SIZE_BYTES = 4_096;

    /** Thời gian chờ mở kết nối TCP tới máy in. */
    public static final int LAN_CONNECT_TIMEOUT_MS = 5_000;

    /** Chu kỳ hỏi dữ liệu khi đọc Bluetooth, vì `BluetoothSocket` không có timeout đọc. */
    public static final long READ_POLL_INTERVAL_MS = 20;

    /** Thời gian chờ tối thiểu trước khi đóng Bluetooth sau một lần ghi nhỏ. */
    public static final long DRAIN_MIN_WAIT_MS = 100;

    /** Lần ghi Bluetooth không lớn hơn mức này chỉ chờ `DRAIN_MIN_WAIT_MS` trước khi đóng. */
    public static final int DRAIN_SMALL_PAYLOAD_BYTES = 2_000;

    /** Tốc độ ước lượng máy in nhận dữ liệu qua SPP, dùng để chờ dữ liệu cuối kịp gửi trước khi đóng. */
    public static final int DRAIN_BYTES_PER_MS = 5;

    private TransportConstants() {
    }
}

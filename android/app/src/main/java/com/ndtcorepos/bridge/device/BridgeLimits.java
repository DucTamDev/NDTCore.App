package com.ndtcorepos.bridge.device;

/** Giới hạn tham số số học nhận từ JS; vượt giới hạn thì bridge báo `INVALID_ARGUMENT`. */
final class BridgeLimits {

    /** Phản hồi máy in chỉ vài chục byte; chặn JS xin cấp phát mảng quá lớn. */
    static final int MAX_READ_BYTES = 64 * 1024;

    /** Một thao tác ghi/đọc dài nhất được chờ; chặn hạn quá lớn làm tràn số khi cộng vào đồng hồ. */
    static final long MAX_OPERATION_TIMEOUT_MS = 10 * 60 * 1000;

    private BridgeLimits() {
    }
}

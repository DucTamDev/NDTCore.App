package com.ndtcorepos.thermalprinter.printer;

/**
 * Vòng đời 1 printer trong Registry.
 */
public enum PrinterState {
    /** Đang mở kết nối. */
    CONNECTING,
    /** Đã kết nối, sẵn sàng ghi. */
    CONNECTED,
    /** Đang đóng kết nối. */
    DISCONNECTING,
    /** Đã đóng kết nối. */
    DISCONNECTED,
    /** Gặp lỗi kết nối/ghi không phục hồi trong lần thao tác gần nhất. */
    ERROR
}

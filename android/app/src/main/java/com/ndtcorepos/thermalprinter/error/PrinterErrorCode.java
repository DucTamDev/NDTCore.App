package com.ndtcorepos.thermalprinter.error;

/** Chỉ giữ code thực sự phát sinh khi port lại logic cũ — không thêm code "phòng khi cần sau này". */
public enum PrinterErrorCode {
    UNSUPPORTED_CONNECTION,

    DEVICE_NOT_FOUND,
    DEVICE_NOT_CONNECTED,

    DISCOVERY_FAILED,
    CONNECTION_FAILED,

    WRITE_FAILED
}

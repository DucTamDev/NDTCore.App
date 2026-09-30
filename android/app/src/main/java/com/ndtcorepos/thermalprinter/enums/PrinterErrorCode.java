package com.ndtcorepos.thermalprinter.enums;

/** Enumerates expected transport-level printer operation failures. */
public enum PrinterErrorCode {
    NONE,
    DEVICE_NOT_FOUND,
    PERMISSION_DENIED,
    CONNECTION_FAILED,
    CONNECTION_CLOSED,
    INVALID_ENDPOINT,
    WRITE_FAILED,
    WRITE_TIMEOUT
}

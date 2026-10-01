package com.ndtcorepos.device.error;

/** Mã lỗi của tầng thiết bị; tên enum chính là mã JS nhận được. */
public enum DeviceErrorCode {
    INVALID_ARGUMENT,
    DEVICE_NOT_FOUND,
    AMBIGUOUS_DEVICE,
    PERMISSION_DENIED,
    BLUETOOTH_DISABLED,
    CONNECTION_FAILED,
    NOT_CONNECTED,
    CONNECTION_LOST,
    WRITE_FAILED,
    WRITE_TIMEOUT,
    READ_NOT_SUPPORTED,
    READ_FAILED,
    SERVICE_CLOSED
}

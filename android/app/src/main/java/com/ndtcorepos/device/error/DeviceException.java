package com.ndtcorepos.device.error;

import com.ndtcorepos.common.CodedException;

/** Lỗi của tầng thiết bị. */
public final class DeviceException extends CodedException {

    private final DeviceErrorCode errorCode;

    /** Số byte chắc chắn đã gửi trước khi lỗi; chỉ có nghĩa với lỗi xảy ra khi ghi. */
    private final int bytesWritten;

    public DeviceException(DeviceErrorCode errorCode, String message) {
        this(errorCode, message, null, 0);
    }

    public DeviceException(
            DeviceErrorCode errorCode,
            String message,
            Throwable cause) {
        this(errorCode, message, cause, 0);
    }

    private DeviceException(
            DeviceErrorCode errorCode,
            String message,
            Throwable cause,
            int bytesWritten) {
        super(message, cause);
        this.errorCode = errorCode;
        this.bytesWritten = bytesWritten;
    }

    /** Bản sao cùng mã và thông báo, kèm số byte đã gửi. */
    public DeviceException withBytesWritten(int bytesWritten) {
        return new DeviceException(errorCode, getMessage(), getCause(), bytesWritten);
    }

    public DeviceErrorCode errorCode() {
        return errorCode;
    }

    public int bytesWritten() {
        return bytesWritten;
    }

    @Override
    public String code() {
        return errorCode.name();
    }
}

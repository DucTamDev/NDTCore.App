package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;

/**
 * Dữ liệu lỗi chuẩn hoá để reject về JS — code + message, không phụ thuộc RN bridge.
 */
public final class PrinterErrorResult {

    private final PrinterErrorCode code;
    private final String message;

    public PrinterErrorResult(PrinterErrorCode code, String message) {
        this.code = code;
        this.message = message;
    }

    /**
     * Mã lỗi chuẩn hoá.
     */
    public PrinterErrorCode getCode() {
        return code;
    }

    /**
     * Thông điệp lỗi.
     */
    public String getMessage() {
        return message;
    }
}

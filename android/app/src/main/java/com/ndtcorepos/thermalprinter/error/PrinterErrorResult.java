package com.ndtcorepos.thermalprinter.error;

import com.facebook.react.bridge.Promise;

/**
 * Chuyển PrinterException/PrinterErrorCode thành 1 lần reject(code, message)
 * duy nhất — mọi @ReactMethod trong PrinterModule dùng chung, không rải
 * string literal riêng lẻ ở từng catch-block.
 */
public final class PrinterErrorResult {

    private final PrinterErrorCode code;
    private final String message;

    public PrinterErrorResult(PrinterErrorCode code, String message) {
        this.code = code;
        this.message = message;
    }

    public static PrinterErrorResult from(PrinterException exception) {
        return new PrinterErrorResult(exception.getCode(), exception.getMessage());
    }

    public void rejectTo(Promise promise) {
        promise.reject(code.name(), message);
    }
}

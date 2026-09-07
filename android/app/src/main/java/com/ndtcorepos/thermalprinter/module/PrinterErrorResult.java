package com.ndtcorepos.thermalprinter.module;

import com.facebook.react.bridge.Promise;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Chuyển PrinterException/PrinterErrorCode thành 1 lần reject(code, message)
 * duy nhất — mọi @ReactMethod trong ThermalPrinterModule dùng chung, không
 * rải string literal riêng lẻ ở từng catch-block.
 */
public final class PrinterErrorResult {

    private final PrinterErrorCode code;
    private final String message;

    public PrinterErrorResult(PrinterErrorCode code, String message) {
        this.code = code;
        this.message = message;
    }

    public static PrinterErrorResult from(PrinterException e) {
        return new PrinterErrorResult(e.getCode(), e.getMessage());
    }

    public void rejectTo(Promise promise) {
        promise.reject(code.name(), message);
    }
}

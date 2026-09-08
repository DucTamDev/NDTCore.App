package com.ndtcorepos.thermalprinter.helper;

import com.facebook.react.bridge.Promise;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterErrorResult;

/**
 * Chuyển PrinterException thành PrinterErrorResult và reject 1 Promise theo
 * đúng format (code, message) — mọi @ReactMethod trong PrinterModule dùng
 * chung, không rải string literal riêng lẻ ở từng catch-block.
 */
public final class PrinterErrorResultHelper {

    private PrinterErrorResultHelper() {
    }

    /**
     * Dựng PrinterErrorResult từ 1 PrinterException.
     */
    public static PrinterErrorResult from(PrinterException e) {
        return new PrinterErrorResult(e.getCode(), e.getMessage());
    }

    /**
     * Reject promise theo đúng format (code, message) của result.
     */
    public static void rejectTo(Promise promise, PrinterErrorResult result) {
        promise.reject(result.getCode().name(), result.getMessage());
    }
}

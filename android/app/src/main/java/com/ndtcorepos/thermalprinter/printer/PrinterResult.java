package com.ndtcorepos.thermalprinter.printer;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;

/**
 * Kết quả 1 thao tác native (connect/disconnect/...), không kèm dữ liệu nghiệp vụ.
 */
public record PrinterResult(boolean success, PrinterErrorCode errorCode, String message, long durationMs) {

    /**
     * Tạo kết quả thành công.
     *
     * @param durationMs thời gian thực hiện thao tác (mili-giây)
     */
    public static PrinterResult success(long durationMs) {
        return new PrinterResult(true, null, null, durationMs);
    }

    /**
     * Tạo kết quả thất bại.
     *
     * @param errorCode mã lỗi
     * @param message thông điệp lỗi
     * @param durationMs thời gian thực hiện thao tác (mili-giây)
     */
    public static PrinterResult failure(PrinterErrorCode errorCode, String message, long durationMs) {
        return new PrinterResult(false, errorCode, message, durationMs);
    }
}

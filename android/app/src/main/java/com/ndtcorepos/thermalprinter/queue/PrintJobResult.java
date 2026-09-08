package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;

/**
 * Kết quả cuối cùng của 1 PrintJob.
 */
public record PrintJobResult(String jobId, String printerId, boolean success, PrinterErrorCode errorCode, String message, long durationMs) {

    /**
     * Tạo kết quả thành công.
     *
     * @param jobId id job
     * @param printerId printer đích
     * @param durationMs thời gian thực thi (mili-giây)
     */
    public static PrintJobResult success(String jobId, String printerId, long durationMs) {
        return new PrintJobResult(jobId, printerId, true, null, null, durationMs);
    }

    /**
     * Tạo kết quả thất bại.
     *
     * @param jobId id job
     * @param printerId printer đích
     * @param errorCode mã lỗi
     * @param message thông điệp lỗi
     * @param durationMs thời gian thực thi (mili-giây)
     */
    public static PrintJobResult failure(String jobId, String printerId, PrinterErrorCode errorCode, String message, long durationMs) {
        return new PrintJobResult(jobId, printerId, false, errorCode, message, durationMs);
    }
}

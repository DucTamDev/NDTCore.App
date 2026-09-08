package com.ndtcorepos.thermalprinter.transport;

import com.ndtcorepos.thermalprinter.printer.PrinterResult;

import java.util.concurrent.CompletableFuture;

/**
 * Lifecycle của 1 kênh giao tiếp với printer — không ghi dữ liệu.
 */
public interface PrinterConnection {

    /**
     * Mở kênh giao tiếp.
     */
    CompletableFuture<PrinterResult> open();

    /**
     * Đóng kênh giao tiếp — gọi nhiều lần không lỗi (idempotent).
     */
    CompletableFuture<PrinterResult> close();

    /**
     * Kênh có đang mở không.
     */
    boolean isOpen();
}

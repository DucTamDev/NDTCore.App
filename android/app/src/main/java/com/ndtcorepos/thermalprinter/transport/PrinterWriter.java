package com.ndtcorepos.thermalprinter.transport;

import com.ndtcorepos.thermalprinter.printer.PrinterResult;

import java.util.concurrent.CompletableFuture;

/**
 * Ghi raw bytes trên 1 kênh đã mở.
 */
public interface PrinterWriter {

    /**
     * Ghi bytes — ném lỗi nếu kênh chưa mở hoặc ghi thất bại.
     *
     * @param data dữ liệu cần ghi
     */
    CompletableFuture<PrinterResult> write(byte[] data);
}

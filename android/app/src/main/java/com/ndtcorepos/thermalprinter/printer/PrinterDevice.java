package com.ndtcorepos.thermalprinter.printer;

import java.util.concurrent.CompletableFuture;

/**
 * Đại diện 1 printer cụ thể — điều phối connection/writer, không tự biết protocol.
 */
public interface PrinterDevice {

    /**
     * Metadata của printer này.
     */
    PrinterInfo getInfo();

    /**
     * Trạng thái vòng đời hiện tại.
     */
    PrinterState getState();

    /**
     * Đang kết nối không.
     */
    boolean isConnected();

    /**
     * Mở kết nối — idempotent nếu đã CONNECTED.
     */
    CompletableFuture<PrinterResult> connect();

    /**
     * Đóng kết nối — idempotent nếu đã DISCONNECTED.
     */
    CompletableFuture<PrinterResult> disconnect();

    /**
     * Ghi raw bytes — không tự động connect lại nếu chưa kết nối.
     *
     * @param data dữ liệu cần ghi
     */
    CompletableFuture<PrinterResult> write(byte[] data);
}

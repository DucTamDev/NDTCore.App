package com.ndtcorepos.thermalprinter.transport.net;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.exception.PrinterWriteException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.CompletableFuture;

/**
 * Ghi bytes qua OutputStream TCP.
 */
public final class NetWriter implements PrinterWriter {

    private final NetConnection connection;

    public NetWriter(NetConnection connection) {
        this.connection = connection;
    }

    /**
     * Ghi bytes rồi flush OutputStream.
     *
     * @param data dữ liệu cần ghi
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        long startedAt = System.currentTimeMillis();
        if (!connection.isOpen()) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.NOT_CONNECTED,
                    "LAN connection is not built, may be you forgot to connect"));
        }
        try {
            OutputStream out = connection.getOutputStream();
            out.write(data);
            out.flush();
        } catch (IOException e) {
            return CompletableFuture.failedFuture(new PrinterWriteException(PrinterErrorCode.WRITE_FAILED, "Failed to write data: " + e.getMessage(), e));
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }
}

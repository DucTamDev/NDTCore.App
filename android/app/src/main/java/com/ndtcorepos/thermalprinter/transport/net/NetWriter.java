package com.ndtcorepos.thermalprinter.transport.net;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.exception.PrinterWriteException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.IPrinterWriter;

import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.CompletableFuture;

/**
 * Ghi bytes qua OutputStream TCP.
 */
public final class NetWriter implements IPrinterWriter {

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
            String message = "LAN connection is not built, may be you forgot to connect";
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.NOT_CONNECTED, message));
        }

        try {
            OutputStream out = connection.getOutputStream();
            out.write(data);
            out.flush();
        } catch (IOException exception) {
            String message = "Failed to write data: " + exception.getMessage();
            return CompletableFuture.failedFuture(new PrinterWriteException(PrinterErrorCode.WRITE_FAILED, message, exception));
        }

        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }
}

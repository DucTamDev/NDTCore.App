package com.ndtcorepos.thermalprinter.writer.net;

import com.ndtcorepos.thermalprinter.connection.net.NetConnection;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.IPrinterWriter;

import java.io.IOException;
import java.io.OutputStream;

/** Writes raw bytes to a printer over an open TCP connection. */
public final class NetWriter implements IPrinterWriter {

    private static final int DEFAULT_TIMEOUT = 5_000;

    private final NetConnection connection;

    public NetWriter(NetConnection connection) {
        this.connection = connection;
    }

    @Override
    public synchronized PrinterWriteResult write(byte[] data) {
        return write(data, DEFAULT_TIMEOUT);
    }

    /**
     * Writes bytes and flushes the socket's OutputStream.
     *
     * @param data raw printer bytes
     * @param timeout unused — TCP writes block on the OS socket buffer, which
     *     has no configurable per-call timeout on Android
     */
    @Override
    public synchronized PrinterWriteResult write(byte[] data, int timeout) {
        if (data == null || data.length == 0) {
            return PrinterWriteResult.success(0);
        }

        if (!connection.isConnected()) {
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_CLOSED, 0);
        }

        try {
            OutputStream out = connection.getOutputStream();
            out.write(data);
            out.flush();
        } catch (IOException exception) {
            return PrinterWriteResult.failure(PrinterErrorCode.WRITE_FAILED, 0);
        }

        return PrinterWriteResult.success(data.length);
    }
}

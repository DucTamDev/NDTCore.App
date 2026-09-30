package com.ndtcorepos.thermalprinter.writer.bluetooth;

import com.ndtcorepos.thermalprinter.connection.bluetooth.BluetoothConnection;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.IPrinterWriter;

import java.io.IOException;
import java.io.OutputStream;

/** Writes raw bytes to a printer over an open Bluetooth RFCOMM connection. */
public final class BluetoothWriter implements IPrinterWriter {

    private static final int DEFAULT_TIMEOUT = 5_000;

    private final BluetoothConnection connection;

    public BluetoothWriter(BluetoothConnection connection) {
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
     * @param timeout unused — RFCOMM writes block on the OS socket buffer, which
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
            connection.markPendingDrain(data.length);
        } catch (IOException exception) {
            return PrinterWriteResult.failure(PrinterErrorCode.WRITE_FAILED, 0);
        }

        return PrinterWriteResult.success(data.length);
    }
}

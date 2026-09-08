package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.printer.PrinterDevice;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.printer.PrinterState;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.util.concurrent.CompletableFuture;

/**
 * PrinterDevice cho kết nối USB — phối hợp UsbConnection + UsbWriter.
 */
public final class UsbPrinterDevice implements PrinterDevice {

    private final PrinterInfo info;
    private final PrinterConnection connection;
    private final PrinterWriter writer;
    private volatile PrinterState state = PrinterState.CONNECTING;

    public UsbPrinterDevice(PrinterInfo info, PrinterConnection connection, PrinterWriter writer) {
        this.info = info;
        this.connection = connection;
        this.writer = writer;
    }

    @Override
    public PrinterInfo getInfo() {
        return info;
    }

    @Override
    public PrinterState getState() {
        return state;
    }

    @Override
    public boolean isConnected() {
        return state == PrinterState.CONNECTED;
    }

    @Override
    public CompletableFuture<PrinterResult> connect() {
        if (isConnected()) {
            return CompletableFuture.completedFuture(PrinterResult.success(0));
        }
        state = PrinterState.CONNECTING;
        return connection.open().whenComplete((result, error) -> state = error == null ? PrinterState.CONNECTED : PrinterState.ERROR);
    }

    @Override
    public CompletableFuture<PrinterResult> disconnect() {
        if (state == PrinterState.DISCONNECTED) {
            return CompletableFuture.completedFuture(PrinterResult.success(0));
        }
        state = PrinterState.DISCONNECTING;
        return connection.close().whenComplete((result, error) -> state = PrinterState.DISCONNECTED);
    }

    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        return writer.write(data);
    }
}

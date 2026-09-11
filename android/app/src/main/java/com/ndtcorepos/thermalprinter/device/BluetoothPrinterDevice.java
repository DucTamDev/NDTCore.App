package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.printer.IPrinterDevice;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.printer.PrinterState;
import com.ndtcorepos.thermalprinter.transport.IPrinterConnection;
import com.ndtcorepos.thermalprinter.transport.IPrinterWriter;

import java.util.concurrent.CompletableFuture;

/**
 * IPrinterDevice cho kết nối Bluetooth — phối hợp BluetoothConnection + BluetoothWriter.
 */
public final class BluetoothPrinterDevice implements IPrinterDevice {

    private final PrinterInfo info;
    private final IPrinterConnection connection;
    private final IPrinterWriter writer;
    private volatile PrinterState state = PrinterState.CONNECTING;

    public BluetoothPrinterDevice(PrinterInfo info, IPrinterConnection connection, IPrinterWriter writer) {
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

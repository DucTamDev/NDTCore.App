package com.ndtcorepos.thermalprinter.device.bluetooth;

import com.ndtcorepos.thermalprinter.connection.bluetooth.BluetoothConnection;
import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.bluetooth.BluetoothWriter;

/**
 * Coordinates the runtime components required by a Bluetooth printer.
 *
 * BluetoothPrinterDevice owns the RFCOMM connection lifecycle and creates the
 * writer after the connection has been successfully opened.
 */
public final class BluetoothPrinterDevice implements IPrinterDevice {

    private final ConnectionIdentity connectionIdentity;
    private final BluetoothConnection connection;
    private BluetoothWriter writer;

    public BluetoothPrinterDevice(ConnectionIdentity connectionIdentity, BluetoothConnection connection) {
        this.connectionIdentity = connectionIdentity;
        this.connection = connection;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        PrinterWriteResult result = connection.open();

        if (!result.isSuccess()) {
            return result;
        }

        writer = new BluetoothWriter(connection);
        return PrinterWriteResult.success(0);
    }

    @Override
    public synchronized PrinterWriteResult write(byte[] data) {
        if (writer == null) {
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_CLOSED, 0);
        }

        return writer.write(data);
    }

    @Override
    public synchronized PrinterWriteResult close() {
        writer = null;
        return connection.close();
    }

    @Override
    public ConnectionIdentity getConnectionIdentity() {
        return connectionIdentity;
    }

    @Override
    public ConnectionState getState() {
        return connection.getState();
    }
}

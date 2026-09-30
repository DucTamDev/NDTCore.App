package com.ndtcorepos.thermalprinter.device.net;

import com.ndtcorepos.thermalprinter.connection.net.NetConnection;
import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.net.NetWriter;

/**
 * Coordinates the runtime components required by a network (LAN) printer.
 *
 * NetworkPrinterDevice owns the TCP connection lifecycle and creates the
 * writer after the connection has been successfully opened.
 */
public final class NetworkPrinterDevice implements IPrinterDevice {

    private final ConnectionIdentity connectionIdentity;
    private final NetConnection connection;
    private NetWriter writer;

    public NetworkPrinterDevice(ConnectionIdentity connectionIdentity, NetConnection connection) {
        this.connectionIdentity = connectionIdentity;
        this.connection = connection;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        PrinterWriteResult result = connection.open();

        if (!result.isSuccess()) {
            return result;
        }

        writer = new NetWriter(connection);
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

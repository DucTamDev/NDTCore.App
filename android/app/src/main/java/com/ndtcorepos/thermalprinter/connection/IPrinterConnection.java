package com.ndtcorepos.thermalprinter.connection;

import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Defines the lifecycle operations of a printer transport connection.
 *
 * A connection owns transport resources such as USB interfaces,
 * Bluetooth sockets, or network sockets.
 *
 * A connection does not encode or transmit printer data.
 */
public interface IPrinterConnection {

    /**
     * Returns the current connection state.
     *
     * @return connection state
     */
    ConnectionState getState();


    /**
     * Opens the transport connection.
     *
     * @return operation result
     */
    PrinterWriteResult open();


    /**
     * Closes the transport connection and releases its resources.
     *
     * @return operation result
     */
    PrinterWriteResult close();


    /**
     * Indicates whether the transport is currently connected.
     *
     * @return true when connected
     */
    boolean isConnected();
}

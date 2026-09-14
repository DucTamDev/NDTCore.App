package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Represents one physical printer runtime.
 *
 * A printer device coordinates its connection and writer.
 * It does not understand printer protocols or printing business types.
 */
public interface IPrinterDevice {

    /**
     * Returns the runtime identity of the physical connection.
     *
     * @return connection identity
     */
    ConnectionIdentity getConnectionIdentity();


    /**
     * Returns the current runtime connection state.
     *
     * @return connection state
     */
    ConnectionState getState();


    /**
     * Opens the physical printer connection.
     *
     * @return operation result
     */
    PrinterWriteResult open();


    /**
     * Writes raw bytes to the physical printer.
     *
     * @param data raw printer bytes
     * @return write result
     */
    PrinterWriteResult write(byte[] data);


    /**
     * Closes the physical printer connection.
     *
     * @return operation result
     */
    PrinterWriteResult close();
}

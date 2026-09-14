package com.ndtcorepos.thermalprinter.device.usb;

import android.hardware.usb.UsbEndpoint;

import com.ndtcorepos.thermalprinter.connection.usb.UsbConnection;
import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.usb.UsbEndpointResolver;
import com.ndtcorepos.thermalprinter.writer.usb.UsbWriter;

/**
 * Coordinates the runtime components required by a USB printer.
 *
 * UsbPrinterDevice owns USB connection lifecycle and creates the writer
 * after the connection has been successfully opened.
 *
 * It does not perform printer protocol encoding or rendering.
 */
public final class UsbPrinterDevice
        implements IPrinterDevice {

    /**
     * Runtime identity of this physical USB connection.
     */
    private final ConnectionIdentity connectionIdentity;

    /**
     * USB connection lifecycle manager.
     */
    private final UsbConnection connection;

    /**
     * USB endpoint resolver used after the connection is opened.
     */
    private final UsbEndpointResolver endpointResolver;


    /**
     * Writer bound to the currently opened USB connection.
     */
    private UsbWriter writer;


    /**
     * Creates a USB printer runtime device.
     *
     * @param connectionIdentity physical connection identity
     * @param connection USB connection lifecycle manager
     * @param endpointResolver USB endpoint resolver
     */
    public UsbPrinterDevice(
            ConnectionIdentity connectionIdentity,
            UsbConnection connection,
            UsbEndpointResolver endpointResolver
    ) {
        this.connectionIdentity = connectionIdentity;
        this.connection = connection;
        this.endpointResolver = endpointResolver;
    }


    /**
     * Opens the USB connection and resolves its bulk OUT endpoint.
     *
     * @return operation result
     */
    @Override
    public synchronized PrinterWriteResult open() {

        PrinterWriteResult result =
                connection.open();

        if (!result.isSuccess()) {
            return result;
        }

        UsbEndpoint endpoint =
                endpointResolver.resolve(
                        connection.getUsbInterface()
                );

        if (endpoint == null) {
            connection.close();

            return PrinterWriteResult.failure(
                    PrinterErrorCode.INVALID_ENDPOINT,
                    0
            );
        }

        writer = new UsbWriter(
                connection.getUsbConnection(),
                endpoint
        );

        return PrinterWriteResult.success(0);
    }


    /**
     * Writes raw bytes through the active USB writer.
     *
     * @param data raw printer bytes
     * @return write result
     */
    @Override
    public synchronized PrinterWriteResult write(
            byte[] data
    ) {
        if (writer == null) {
            return PrinterWriteResult.failure(
                    PrinterErrorCode.CONNECTION_CLOSED,
                    0
            );
        }

        return writer.write(data);
    }


    /**
     * Closes the USB connection and releases the active writer.
     *
     * @return operation result
     */
    @Override
    public synchronized PrinterWriteResult close() {

        writer = null;

        return connection.close();
    }


    /**
     * Returns the physical USB connection identity.
     *
     * @return connection identity
     */
    @Override
    public ConnectionIdentity getConnectionIdentity() {
        return connectionIdentity;
    }


    /**
     * Returns the current USB connection state.
     *
     * @return connection state
     */
    @Override
    public ConnectionState getState() {
        return connection.getState();
    }
}

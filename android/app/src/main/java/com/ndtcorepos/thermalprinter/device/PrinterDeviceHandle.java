package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Represents a temporary consumer handle to a runtime printer device.
 *
 * The handle prevents callers from directly managing the device registry
 * and reference lifecycle.
 */
public final class PrinterDeviceHandle
        implements AutoCloseable {

    /**
     * Runtime device exposed through this handle.
     */
    private final IPrinterDevice device;

    /**
     * Callback used to release the device reference.
     */
    private final Runnable releaseAction;


    /**
     * Indicates whether the handle has already been released.
     */
    private boolean released;


    /**
     * Creates a device handle.
     *
     * @param device runtime printer device
     * @param releaseAction release callback
     */
    public PrinterDeviceHandle(
            IPrinterDevice device,
            Runnable releaseAction
    ) {
        this.device = device;
        this.releaseAction = releaseAction;
    }


    /**
     * Returns the physical connection identity.
     *
     * @return connection identity
     */
    public ConnectionIdentity getConnectionIdentity() {
        return device.getConnectionIdentity();
    }


    /**
     * Opens the printer connection.
     *
     * @return operation result
     */
    public PrinterWriteResult open() {
        return device.open();
    }


    /**
     * Writes raw bytes to the printer.
     *
     * @param data raw printer bytes
     * @return write result
     */
    public PrinterWriteResult write(
            byte[] data
    ) {
        return device.write(data);
    }


    /**
     * Releases this handle.
     *
     * The release operation is executed only once.
     */
    @Override
    public synchronized void close() {

        if (released) {
            return;
        }

        released = true;

        releaseAction.run();
    }
}

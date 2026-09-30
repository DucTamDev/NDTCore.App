package com.ndtcorepos.thermalprinter.queue;

/**
 * Represents one raw byte write job queued for a printer connection.
 *
 * The task contains only transport data.
 * It does not contain printer configuration or protocol information.
 */
public final class PrinterQueueTask {

    /**
     * Raw bytes that must be sent to the printer.
     */
    private final byte[] data;


    /**
     * Creates a printer queue task.
     *
     * @param data raw printer bytes
     */
    public PrinterQueueTask(
            byte[] data
    ) {
        this.data = data;
    }


    /**
     * Returns the raw bytes associated with this task.
     *
     * @return raw printer bytes
     */
    public byte[] getData() {
        return data;
    }
}

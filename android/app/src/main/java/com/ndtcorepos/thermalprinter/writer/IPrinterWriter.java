package com.ndtcorepos.thermalprinter.writer;

import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Defines the transport operation used to send raw bytes to a printer.
 *
 * The writer does not know the meaning of the bytes.
 * The caller is responsible for producing valid printer commands or
 * printer bitmap data.
 */
public interface IPrinterWriter {

    /**
     * Writes raw printer bytes using the writer's default timeout.
     *
     * @param data raw bytes to transmit
     * @return write result
     */
    PrinterWriteResult write(byte[] data);


    /**
     * Writes raw printer bytes using the specified timeout.
     *
     * @param data raw bytes to transmit
     * @param timeout timeout in milliseconds
     * @return write result
     */
    PrinterWriteResult write(
            byte[] data,
            int timeout
    );
}

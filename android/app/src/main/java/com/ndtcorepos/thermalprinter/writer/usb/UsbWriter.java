package com.ndtcorepos.thermalprinter.writer.usb;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbRequest;

import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.IPrinterWriter;

import java.nio.ByteBuffer;

/**
 * Writes raw bytes to a USB printer.
 *
 * UsbRequest is the primary USB transfer mechanism.
 *
 * This class does not manage USB permission, device discovery,
 * connection lifecycle, or printer protocol encoding.
 */
public final class UsbWriter
        implements IPrinterWriter {

    /**
     * Default timeout used by USB write operations.
     */
    private static final int DEFAULT_TIMEOUT = 5_000;

    /**
     * Active Android USB connection used for transfers.
     */
    private final UsbDeviceConnection usbConnection;

    /**
     * Bulk OUT endpoint used to send printer data.
     */
    private final UsbEndpoint usbEndpoint;


    /**
     * Creates a USB writer.
     *
     * @param usbConnection active USB connection
     * @param usbEndpoint bulk OUT endpoint
     */
    public UsbWriter(
            UsbDeviceConnection usbConnection,
            UsbEndpoint usbEndpoint
    ) {
        this.usbConnection = usbConnection;
        this.usbEndpoint = usbEndpoint;
    }


    /**
     * Writes raw bytes using the default timeout.
     *
     * @param data raw printer bytes
     * @return write result
     */
    @Override
    public synchronized PrinterWriteResult write(
            byte[] data
    ) {
        return write(data, DEFAULT_TIMEOUT);
    }


    /**
     * Writes raw bytes using UsbRequest.
     *
     * The complete byte array is queued as one USB request.
     *
     * @param data raw printer bytes
     * @param timeout timeout in milliseconds
     * @return write result
     */
    @Override
    public synchronized PrinterWriteResult write(
            byte[] data,
            int timeout
    ) {
        if (data == null || data.length == 0) {
            return PrinterWriteResult.success(0);
        }

        if (usbConnection == null) {
            return PrinterWriteResult.failure(
                    PrinterErrorCode.CONNECTION_CLOSED,
                    0
            );
        }

        if (usbEndpoint == null) {
            return PrinterWriteResult.failure(
                    PrinterErrorCode.INVALID_ENDPOINT,
                    0
            );
        }

        if (usbEndpoint.getType()
                != UsbConstants.USB_ENDPOINT_XFER_BULK) {

            return PrinterWriteResult.failure(
                    PrinterErrorCode.INVALID_ENDPOINT,
                    0
            );
        }

        if (usbEndpoint.getDirection()
                != UsbConstants.USB_DIR_OUT) {

            return PrinterWriteResult.failure(
                    PrinterErrorCode.INVALID_ENDPOINT,
                    0
            );
        }

        return writeWithUsbRequest(
                data,
                timeout
        );
    }


    /**
     * Sends the byte array using Android UsbRequest.
     *
     * @param data raw printer bytes
     * @param timeout timeout in milliseconds
     * @return write result
     */
    private PrinterWriteResult writeWithUsbRequest(
            byte[] data,
            int timeout
    ) {
        UsbRequest request = new UsbRequest();

        try {
            if (!request.initialize(
                    usbConnection,
                    usbEndpoint
            )) {
                return PrinterWriteResult.failure(
                        PrinterErrorCode.WRITE_FAILED,
                        0
                );
            }

            ByteBuffer buffer =
                    ByteBuffer.wrap(data);

            if (!request.queue(
                    buffer,
                    data.length
            )) {
                return PrinterWriteResult.failure(
                        PrinterErrorCode.WRITE_FAILED,
                        0
                );
            }

            UsbRequest completedRequest =
                    usbConnection.requestWait();

            if (completedRequest == null) {
                return PrinterWriteResult.failure(
                        PrinterErrorCode.WRITE_TIMEOUT,
                        0
                );
            }

            return PrinterWriteResult.success(
                    data.length
            );

        } finally {
            request.close();
        }
    }
}

package com.ndtcorepos.thermalprinter.writer.usb;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;

import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.IPrinterWriter;

/**
 * Writes raw bytes to a USB printer.
 *
 * UsbDeviceConnection.bulkTransfer is the primary USB transfer mechanism —
 * it is the only one that honors the caller's timeout on every supported API
 * level, so a printer that stops ACKing cannot block the caller forever.
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
     * Writes raw bytes using a single bulk transfer.
     *
     * The complete byte array is sent as one transfer — callers chunk larger
     * payloads before reaching this layer.
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

        return writeWithBulkTransfer(
                data,
                timeout
        );
    }


    /**
     * Sends the byte array using UsbDeviceConnection.bulkTransfer, which
     * honors the caller's timeout on every supported API level (unlike
     * UsbRequest.queue()/UsbDeviceConnection.requestWait(), whose no-arg
     * overload never times out).
     *
     * @param data raw printer bytes
     * @param timeout timeout in milliseconds
     * @return write result
     */
    private PrinterWriteResult writeWithBulkTransfer(
            byte[] data,
            int timeout
    ) {
        int transferred = usbConnection.bulkTransfer(
                usbEndpoint,
                data,
                data.length,
                timeout
        );

        if (transferred < 0) {
            return PrinterWriteResult.failure(
                    PrinterErrorCode.WRITE_TIMEOUT,
                    0
            );
        }

        return PrinterWriteResult.success(transferred);
    }
}

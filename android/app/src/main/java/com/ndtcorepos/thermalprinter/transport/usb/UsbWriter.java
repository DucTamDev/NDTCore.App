package com.ndtcorepos.thermalprinter.transport.usb;

import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.util.Log;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.exception.PrinterWriteException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.util.concurrent.CompletableFuture;

/**
 * Ghi bytes qua bulk OUT endpoint USB.
 */
public final class UsbWriter implements PrinterWriter {

    private static final String TAG = "UsbWriter";
    private static final int BULK_TRANSFER_TIMEOUT_MS = 100000;

    private final UsbConnection connection;
    private final UsbEndpointResolver endpointResolver;

    public UsbWriter(UsbConnection connection, UsbEndpointResolver endpointResolver) {
        this.connection = connection;
        this.endpointResolver = endpointResolver;
    }

    /**
     * Ghi bytes qua bulk transfer.
     *
     * @param data dữ liệu cần ghi
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        long startedAt = System.currentTimeMillis();
        if (!connection.ensureClaimed()) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(
                    PrinterErrorCode.CONNECTION_FAILED, "USB connection is not ready — permission may still be pending"));
        }

        UsbDeviceConnection deviceConnection = connection.getDeviceConnection();
        UsbInterface claimedInterface = connection.getClaimedInterface();
        try {
            UsbEndpoint endpoint = endpointResolver.resolveEndpoint(claimedInterface);
            int result = deviceConnection.bulkTransfer(endpoint, data, data.length, BULK_TRANSFER_TIMEOUT_MS);
            Log.i(TAG, "bulkTransfer result=" + result);
            if (result < 0) {
                return CompletableFuture.failedFuture(new PrinterWriteException(PrinterErrorCode.WRITE_FAILED, "USB bulk transfer failed"));
            }
        } catch (PrinterConnectionException e) {
            return CompletableFuture.failedFuture(e);
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }
}

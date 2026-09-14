package com.ndtcorepos.thermalprinter.connection.usb;

import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.thermalprinter.connection.IPrinterConnection;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.permission.usb.UsbPermission;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Manages the Android USB resources for one physical printer connection. */
public final class UsbConnection implements IPrinterConnection {

    private static final int PERMISSION_TIMEOUT_SECONDS = 30;

    private final UsbManager usbManager;
    private final UsbDevice device;
    private final UsbInterface usbInterface;
    private final UsbPermission permission;

    private UsbDeviceConnection usbConnection;
    private volatile ConnectionState state = ConnectionState.DISCONNECTED;

    public UsbConnection(
            UsbManager usbManager,
            UsbDevice device,
            UsbInterface usbInterface,
            UsbPermission permission
    ) {
        this.usbManager = usbManager;
        this.device = device;
        this.usbInterface = usbInterface;
        this.permission = permission;
        // close() is already idempotent and does exactly what a physical detach
        // requires (release the interface, close the connection) — reused
        // directly as the detach handler.
        this.permission.registerDeviceDetachListener(device.getVendorId(), device.getProductId(), this::close);
    }

    /**
     * Opens the USB connection, requesting permission first when it isn't
     * already granted.
     *
     * Deliberately NOT `synchronized` — awaitPermission() below can block for
     * up to PERMISSION_TIMEOUT_SECONDS while the system dialog is on screen. If
     * this method held the instance lock during that wait, a device detached
     * mid-dialog could never complete close() (which needs the same lock) to
     * unblock the wait, deadlocking until the timeout instead of failing fast.
     */
    @Override
    public PrinterWriteResult open() {
        if (isConnected()) {
            return PrinterWriteResult.success(0);
        }

        if (usbManager == null || device == null || usbInterface == null) {
            return PrinterWriteResult.failure(PrinterErrorCode.DEVICE_NOT_FOUND, 0);
        }

        if (!permission.hasPermission(device)) {
            boolean granted = awaitPermission();

            if (!granted) {
                return PrinterWriteResult.failure(PrinterErrorCode.PERMISSION_DENIED, 0);
            }
        }

        return claim();
    }

    private synchronized PrinterWriteResult claim() {
        state = ConnectionState.CONNECTING;

        UsbDeviceConnection candidate = usbManager.openDevice(device);

        if (candidate == null || !candidate.claimInterface(usbInterface, true)) {
            if (candidate != null) {
                candidate.close();
            }

            state = ConnectionState.DISCONNECTED;
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }

        usbConnection = candidate;
        state = ConnectionState.CONNECTED;
        return PrinterWriteResult.success(0);
    }

    /**
     * Requests USB permission and blocks until the system dialog's result
     * arrives (granted/denied), the device is detached mid-dialog, or
     * PERMISSION_TIMEOUT_SECONDS elapses — so open() returns one definitive
     * result instead of treating a still-open dialog as "connected".
     */
    private boolean awaitPermission() {
        CompletableFuture<Boolean> future = new CompletableFuture<>();
        int vendorId = device.getVendorId();
        int productId = device.getProductId();

        permission.registerPermissionResultListener(vendorId, productId, future::complete);
        permission.requestPermission(device);

        try {
            return future.get(PERMISSION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        } catch (ExecutionException | TimeoutException exception) {
            return false;
        } finally {
            permission.unregisterPermissionResultListener(vendorId, productId);
        }
    }

    @Override
    public synchronized PrinterWriteResult close() {
        state = ConnectionState.CLOSING;

        if (usbConnection != null) {
            try {
                usbConnection.releaseInterface(usbInterface);
                usbConnection.close();
            } catch (Exception ignored) {
            }
            usbConnection = null;
        }

        state = ConnectionState.DISCONNECTED;
        permission.unregisterDeviceDetachListener(device.getVendorId(), device.getProductId());
        return PrinterWriteResult.success(0);
    }

    @Override
    public ConnectionState getState() {
        return state;
    }

    @Override
    public boolean isConnected() {
        return state == ConnectionState.CONNECTED && usbConnection != null;
    }

    public synchronized UsbDeviceConnection getUsbConnection() {
        return usbConnection;
    }

    public UsbInterface getUsbInterface() {
        return usbInterface;
    }
}

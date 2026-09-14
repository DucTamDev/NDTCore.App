package com.ndtcorepos.thermalprinter.connection.usb;

import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.thermalprinter.connection.IPrinterConnection;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/** Manages the Android USB resources for one physical printer connection. */
public final class UsbConnection implements IPrinterConnection {
    private final UsbManager usbManager;
    private final UsbDevice device;
    private final UsbInterface usbInterface;
    private UsbDeviceConnection usbConnection;
    private ConnectionState state = ConnectionState.DISCONNECTED;

    public UsbConnection(UsbManager usbManager, UsbDevice device, UsbInterface usbInterface) {
        this.usbManager = usbManager;
        this.device = device;
        this.usbInterface = usbInterface;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        if (isConnected()) return PrinterWriteResult.success(0);
        if (usbManager == null || device == null || usbInterface == null) {
            return PrinterWriteResult.failure(PrinterErrorCode.DEVICE_NOT_FOUND, 0);
        }
        if (!usbManager.hasPermission(device)) {
            return PrinterWriteResult.failure(PrinterErrorCode.PERMISSION_DENIED, 0);
        }
        state = ConnectionState.CONNECTING;
        UsbDeviceConnection candidate = usbManager.openDevice(device);
        if (candidate == null || !candidate.claimInterface(usbInterface, true)) {
            if (candidate != null) candidate.close();
            state = ConnectionState.DISCONNECTED;
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }
        usbConnection = candidate;
        state = ConnectionState.CONNECTED;
        return PrinterWriteResult.success(0);
    }

    @Override
    public synchronized PrinterWriteResult close() {
        if (usbConnection == null) {
            state = ConnectionState.DISCONNECTED;
            return PrinterWriteResult.success(0);
        }
        state = ConnectionState.CLOSING;
        usbConnection.releaseInterface(usbInterface);
        usbConnection.close();
        usbConnection = null;
        state = ConnectionState.DISCONNECTED;
        return PrinterWriteResult.success(0);
    }

    @Override public synchronized ConnectionState getState() { return state; }
    @Override public synchronized boolean isConnected() { return state == ConnectionState.CONNECTED && usbConnection != null; }
    public synchronized UsbDeviceConnection getUsbConnection() { return usbConnection; }
    public UsbInterface getUsbInterface() { return usbInterface; }
}

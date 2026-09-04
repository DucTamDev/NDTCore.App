package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import android.bluetooth.BluetoothDevice;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;
import com.ndtcorepos.thermalprinter.model.PrinterDeviceId;

public final class BluetoothPrinterDevice implements PrinterDevice {

    private final BluetoothDevice device;
    private final BluetoothPrinterDeviceId deviceId;

    public BluetoothPrinterDevice(BluetoothDevice device) {
        this.device = device;
        this.deviceId = BluetoothPrinterDeviceId.valueOf(device.getAddress());
    }

    @Override
    public PrinterDeviceId getPrinterDeviceId() {
        return deviceId;
    }

    @Override
    public WritableMap toWritableMap() {
        WritableMap map = Arguments.createMap();
        map.putString("address", device.getAddress());
        map.putString("deviceName", getDeviceNameSafely());
        return map;
    }

    private String getDeviceNameSafely() {
        try {
            return device.getName();
        } catch (SecurityException e) {
            return null;
        }
    }
}

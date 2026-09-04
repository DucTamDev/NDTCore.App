package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import android.bluetooth.BluetoothDevice;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.ndtcorepos.thermalprinter.model.IPrinterDevice;

public final class BluetoothPrinterDevice implements IPrinterDevice {

    private final BluetoothDevice device;

    public BluetoothPrinterDevice(BluetoothDevice device) {
        this.device = device;
    }

    @Override
    public WritableMap toWritableMap() {
        WritableMap map = Arguments.createMap();
        map.putString("inner_mac_address", device.getAddress());
        map.putString("device_name", getDeviceNameSafely());
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

package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import com.ndtcorepos.thermalprinter.model.PrinterDeviceId;

public final class BluetoothPrinterDeviceId extends PrinterDeviceId {

    private final String address;

    public static BluetoothPrinterDeviceId valueOf(String address) {
        return new BluetoothPrinterDeviceId(address);
    }

    private BluetoothPrinterDeviceId(String address) {
        this.address = address;
    }

    public String getAddress() {
        return address;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BluetoothPrinterDeviceId)) return false;
        return address.equals(((BluetoothPrinterDeviceId) o).address);
    }

    @Override
    public int hashCode() {
        return address.hashCode();
    }
}

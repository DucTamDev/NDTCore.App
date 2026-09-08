package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public final class BluetoothPrinterDiscovery implements IPrinterDiscovery {

    @Override
    public List<PrinterInfo> discover() throws PrinterException {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "No bluetooth adapter available");
        }
        if (!adapter.isEnabled()) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "Bluetooth is not enabled");
        }

        List<PrinterInfo> devices = new ArrayList<>();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        for (BluetoothDevice device : bonded) {
            devices.add(new PrinterInfo(null, ConnectionType.BLUETOOTH, getDeviceNameSafely(device), null, null, null, null, null, device.getAddress(), null, null));
        }
        return devices;
    }

    private String getDeviceNameSafely(BluetoothDevice device) {
        try {
            return device.getName();
        } catch (SecurityException ignored) {
            return null;
        }
    }
}

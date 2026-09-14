package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;

/**
 * Discovers Bluetooth printers already bonded (paired) in Android system settings.
 *
 * Discovery does not open the devices and does not request permission — it
 * returns an empty list when Bluetooth is unavailable, disabled, or the
 * BLUETOOTH_CONNECT permission has not been granted yet, rather than throwing
 * (IPrinterDiscovery.discover() declares no checked exception).
 */
public final class BluetoothPrinterDiscovery implements IPrinterDiscovery {

    @Override
    public List<PrinterDescriptor> discover() {
        List<PrinterDescriptor> devices = new ArrayList<>();

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();

        if (adapter == null || !adapter.isEnabled()) {
            return devices;
        }

        for (BluetoothDevice device : getBondedDevicesSafely(adapter)) {
            devices.add(createDescriptor(device));
        }

        return devices;
    }

    /**
     * Reads bonded devices via BluetoothAdapter.getBondedDevices() — Android 12+
     * throws SecurityException without BLUETOOTH_CONNECT, treated as "no
     * devices" rather than a discovery failure.
     */
    private Set<BluetoothDevice> getBondedDevicesSafely(BluetoothAdapter adapter) {
        try {
            return adapter.getBondedDevices();
        } catch (SecurityException exception) {
            return Collections.emptySet();
        }
    }

    private PrinterDescriptor createDescriptor(BluetoothDevice device) {
        return new PrinterDescriptor(
                ConnectionType.BLUETOOTH,
                getNameSafely(device),
                null,
                null,
                null,
                null,
                null,
                device.getAddress(),
                null
        );
    }

    /**
     * Reads the device name via BluetoothDevice.getName() — Android 12+ throws
     * SecurityException without BLUETOOTH_CONNECT, treated as an unnamed device
     * rather than failing the whole scan.
     */
    private String getNameSafely(BluetoothDevice device) {
        try {
            return device.getName();
        } catch (SecurityException ignored) {
            return null;
        }
    }
}

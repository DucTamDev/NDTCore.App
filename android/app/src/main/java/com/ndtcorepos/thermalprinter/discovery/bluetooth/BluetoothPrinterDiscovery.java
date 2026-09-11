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

/**
 * Quét các thiết bị Bluetooth đã ghép đôi (bonded) và dựng PrinterInfo tương ứng.
 */
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

        Set<BluetoothDevice> bonded = getBondedDevicesSafely(adapter);
        List<PrinterInfo> devices = new ArrayList<>();

        for (BluetoothDevice device : bonded) {
            devices.add(toPrinterInfo(device));
        }

        return devices;
    }

    /**
     * Đọc danh sách bonded devices qua BluetoothAdapter.getBondedDevices() —
     * từ Android 12 trở lên ném SecurityException nếu thiếu quyền
     * BLUETOOTH_CONNECT, phải ánh xạ thành PrinterException để không phá vỡ
     * Promise boundary ở module/.
     */
    private Set<BluetoothDevice> getBondedDevicesSafely(BluetoothAdapter adapter) throws PrinterException {
        try {
            return adapter.getBondedDevices();
        } catch (SecurityException exception) {
            throw new PrinterException(PrinterErrorCode.PERMISSION_DENIED, "Missing BLUETOOTH_CONNECT permission", exception);
        }
    }

    private PrinterInfo toPrinterInfo(BluetoothDevice device) {
        String name = getDeviceNameSafely(device);
        String address = device.getAddress();

        return new PrinterInfo(
                null,
                ConnectionType.BLUETOOTH,
                name,
                null,
                null,
                null,
                null,
                null,
                address,
                null,
                null);
    }

    /**
     * Đọc tên thiết bị qua BluetoothDevice.getName() — từ Android 12 trở
     * lên, API này ném SecurityException nếu app chưa có quyền
     * BLUETOOTH_CONNECT, nên phải bọc try/catch và coi như không có tên
     * thay vì làm hỏng cả lần quét.
     */
    private String getDeviceNameSafely(BluetoothDevice device) {
        try {
            return device.getName();
        } catch (SecurityException ignored) {
            return null;
        }
    }
}

package com.ndtcorepos.device.discovery;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.Context;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Liệt kê thiết bị Bluetooth đã ghép đôi và tìm thiết bị theo MAC. Quyền Bluetooth do TS xin. */
public final class BluetoothDiscovery implements IDeviceDiscovery {

    private final Context context;

    public BluetoothDiscovery(Context context) {
        this.context = context;
    }

    @Override
    public List<DeviceInfo> discover() throws DeviceException {
        List<DeviceInfo> devices = new ArrayList<>();

        for (BluetoothDevice device : bondedDevices()) {
            devices.add(toDeviceInfo(device));
        }

        return devices;
    }

    public BluetoothDevice findBonded(String mac) throws DeviceException {
        for (BluetoothDevice device : bondedDevices()) {
            if (device.getAddress().equalsIgnoreCase(mac)) {
                return device;
            }
        }

        throw new DeviceException(
                DeviceErrorCode.DEVICE_NOT_FOUND,
                "Không thấy thiết bị Bluetooth đã ghép đôi: " + mac);
    }

    /** Thiết bị đã ghép đôi qua BluetoothAdapter; từ Android 12 cần quyền BLUETOOTH_CONNECT. */
    private Set<BluetoothDevice> bondedDevices() throws DeviceException {
        BluetoothAdapter adapter = requireEnabledAdapter();

        try {
            return adapter.getBondedDevices();
        } catch (SecurityException exception) {
            throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "Thiếu quyền Bluetooth", exception);
        }
    }

    private BluetoothAdapter requireEnabledAdapter() throws DeviceException {
        BluetoothManager manager = context.getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();

        if (adapter == null || !adapter.isEnabled()) {
            throw new DeviceException(DeviceErrorCode.BLUETOOTH_DISABLED, "Bluetooth đang tắt hoặc không có");
        }

        return adapter;
    }

    private static DeviceInfo toDeviceInfo(BluetoothDevice device) throws DeviceException {
        DeviceAddress address = DeviceAddress.bluetooth(device.getAddress());
        return DeviceInfo.bluetooth("bluetooth:" + address.mac(), readName(device), address);
    }

    /** Từ Android 12, đọc tên khi thiếu quyền BLUETOOTH_CONNECT ném SecurityException. */
    private static String readName(BluetoothDevice device) {
        try {
            return device.getName();
        } catch (SecurityException exception) {
            return null;
        }
    }
}

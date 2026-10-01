package com.ndtcorepos.device.transport;

import android.hardware.usb.UsbManager;

import com.ndtcorepos.device.discovery.BluetoothDiscovery;
import com.ndtcorepos.device.discovery.UsbDiscovery;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceType;

import java.util.concurrent.ScheduledExecutorService;

/** Tạo đúng transport cho một địa chỉ; transport trả về chưa mở. */
public final class TransportFactory implements ITransportFactory {

    private final UsbManager usbManager;

    private final UsbDiscovery usbDiscovery;

    private final BluetoothDiscovery bluetoothDiscovery;

    /** Hẹn giờ đóng socket khi ghi quá hạn, dùng chung cho mọi transport Bluetooth/LAN. */
    private final ScheduledExecutorService timer;

    public TransportFactory(
            UsbManager usbManager,
            UsbDiscovery usbDiscovery,
            BluetoothDiscovery bluetoothDiscovery,
            ScheduledExecutorService timer) {
        this.usbManager = usbManager;
        this.usbDiscovery = usbDiscovery;
        this.bluetoothDiscovery = bluetoothDiscovery;
        this.timer = timer;
    }

    @Override
    public ITransport create(DeviceAddress address) throws DeviceException {
        if (address.type() == DeviceType.USB) {
            return createUsb(address);
        }

        if (address.type() == DeviceType.BLUETOOTH) {
            return createBluetooth(address);
        }

        return createLan(address);
    }

    private ITransport createUsb(DeviceAddress address) throws DeviceException {
        return new UsbTransport(usbManager, usbDiscovery.find(address));
    }

    private ITransport createBluetooth(DeviceAddress address) throws DeviceException {
        return new BluetoothTransport(bluetoothDiscovery.findBonded(address.mac()), timer);
    }

    private ITransport createLan(DeviceAddress address) {
        return new LanTransport(address.host(), address.port(), timer);
    }
}

package com.ndtcorepos.device;

import android.content.Context;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.connection.IDisconnectListener;
import com.ndtcorepos.device.discovery.BluetoothDiscovery;
import com.ndtcorepos.device.discovery.IDeviceDiscovery;
import com.ndtcorepos.device.discovery.UsbDiscovery;
import com.ndtcorepos.device.enums.TransportType;
import com.ndtcorepos.device.monitor.BluetoothDisconnectMonitor;
import com.ndtcorepos.device.monitor.IDisconnectMonitor;
import com.ndtcorepos.device.monitor.UsbDetachMonitor;
import com.ndtcorepos.device.permission.UsbPermission;
import com.ndtcorepos.device.transport.TransportFactory;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/** Nơi lắp ráp tầng thiết bị: tạo các phần sống suốt vòng đời service, nối chúng lại và trả service đã sẵn sàng. */
public final class DeviceFactory {

    private DeviceFactory() {
    }

    public static DeviceService create(Context context, IDisconnectListener listener) {
        UsbManager usbManager = context.getSystemService(UsbManager.class);
        UsbPermission usbPermission = new UsbPermission(context, usbManager);
        UsbDiscovery usbDiscovery = new UsbDiscovery(usbManager, usbPermission);
        BluetoothDiscovery bluetoothDiscovery = new BluetoothDiscovery(context);
        ScheduledExecutorService timerExecutor = Executors.newSingleThreadScheduledExecutor();

        TransportFactory transportFactory = new TransportFactory(
                usbManager,
                usbDiscovery,
                bluetoothDiscovery,
                timerExecutor);
        ConnectionPool connectionPool = new ConnectionPool(
                transportFactory,
                listener,
                Executors.newCachedThreadPool(),
                Executors.newSingleThreadExecutor(),
                Executors::newSingleThreadExecutor);

        Map<TransportType, IDeviceDiscovery> discoveries = new EnumMap<>(TransportType.class);
        discoveries.put(TransportType.USB, usbDiscovery);
        discoveries.put(TransportType.BLUETOOTH, bluetoothDiscovery);

        List<IDisconnectMonitor> monitors = Arrays.asList(
                new UsbDetachMonitor(context, connectionPool),
                new BluetoothDisconnectMonitor(context, connectionPool));

        DeviceService deviceService = new DeviceService(
                discoveries,
                connectionPool,
                monitors,
                Executors.newSingleThreadExecutor(),
                timerExecutor);
        deviceService.start();
        return deviceService;
    }
}

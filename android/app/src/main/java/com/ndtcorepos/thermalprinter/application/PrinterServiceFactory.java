package com.ndtcorepos.thermalprinter.application;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.bluetooth.BluetoothPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.bluetooth.BluetoothPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.network.NetworkPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.usb.UsbPrinterTransport;

import java.util.EnumMap;
import java.util.Map;

/**
 * Composition root cho {@link PrinterService} — tách khỏi ThermalPrinterModule
 * để module RN chỉ còn lo Callback boundary, không tự dựng transport/discovery.
 */
public final class PrinterServiceFactory {

    private PrinterServiceFactory() {
    }

    public static PrinterService create(ReactApplicationContext context, UsbPermission usbPermission) {
        Map<ConnectionType, IPrinterTransport> transports = new EnumMap<>(ConnectionType.class);
        transports.put(ConnectionType.USB, new UsbPrinterTransport(context, usbPermission));
        transports.put(ConnectionType.BLUETOOTH, new BluetoothPrinterTransport());
        transports.put(ConnectionType.LAN, new NetworkPrinterTransport());

        Map<ConnectionType, IPrinterDiscovery> discoveries = new EnumMap<>(ConnectionType.class);
        discoveries.put(ConnectionType.USB, new UsbPrinterDiscovery(context));
        discoveries.put(ConnectionType.BLUETOOTH, new BluetoothPrinterDiscovery());

        return new PrinterService(new TransportResolver(transports), discoveries);
    }
}

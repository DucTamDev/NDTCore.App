package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Đích kết nối bất biến — Native chỉ thấy vendorId/productId (USB), mac
 * address (Bluetooth) hoặc host/port (LAN); không biết ESC/POS/TSPL.
 */
public final class PrinterConnection {

    private final ConnectionType type;
    private final Integer usbVendorId;
    private final Integer usbProductId;
    private final String bluetoothAddress;
    private final String lanHost;
    private final Integer lanPort;

    private PrinterConnection(ConnectionType type, Integer usbVendorId, Integer usbProductId,
            String bluetoothAddress, String lanHost, Integer lanPort) {
        this.type = type;
        this.usbVendorId = usbVendorId;
        this.usbProductId = usbProductId;
        this.bluetoothAddress = bluetoothAddress;
        this.lanHost = lanHost;
        this.lanPort = lanPort;
    }

    public static PrinterConnection usb(int vendorId, int productId) {
        return new PrinterConnection(ConnectionType.USB, vendorId, productId, null, null, null);
    }

    public static PrinterConnection bluetooth(String address) {
        return new PrinterConnection(ConnectionType.BLUETOOTH, null, null, address, null, null);
    }

    public static PrinterConnection lan(String host, int port) {
        return new PrinterConnection(ConnectionType.LAN, null, null, null, host, port);
    }

    public ConnectionType getType() {
        return type;
    }

    public int getUsbVendorId() {
        return usbVendorId;
    }

    public int getUsbProductId() {
        return usbProductId;
    }

    public String getBluetoothAddress() {
        return bluetoothAddress;
    }

    public String getLanHost() {
        return lanHost;
    }

    public int getLanPort() {
        return lanPort;
    }
}

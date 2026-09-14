package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Describes a physical printer discovered by a transport.
 *
 * PrinterDescriptor contains discovery information only.
 * It does not represent an opened runtime connection.
 */
public final class PrinterDescriptor {

    /**
     * Transport through which the device was discovered.
     */
    private final ConnectionType connectionType;

    /**
     * Platform or transport-specific device name.
     */
    private final String deviceName;

    /**
     * Manufacturer name reported by the device.
     */
    private final String manufacturer;

    /**
     * Product name reported by the device.
     */
    private final String productName;

    /**
     * Hardware serial number when available.
     */
    private final String serialNumber;

    /**
     * USB vendor ID when the device is a USB device.
     */
    private final Integer vendorId;

    /**
     * USB product ID when the device is a USB device.
     */
    private final Integer productId;

    /**
     * Bluetooth MAC address or network host.
     */
    private final String address;

    /**
     * Network port when the device uses a network connection.
     */
    private final Integer port;


    /**
     * Creates a discovered printer descriptor.
     *
     * @param connectionType transport type
     * @param deviceName device name
     * @param manufacturer manufacturer name
     * @param productName product name
     * @param serialNumber serial number
     * @param vendorId USB vendor ID
     * @param productId USB product ID
     * @param address Bluetooth address or network host
     * @param port network port
     */
    public PrinterDescriptor(
            ConnectionType connectionType,
            String deviceName,
            String manufacturer,
            String productName,
            String serialNumber,
            Integer vendorId,
            Integer productId,
            String address,
            Integer port
    ) {
        this.connectionType = connectionType;
        this.deviceName = deviceName;
        this.manufacturer = manufacturer;
        this.productName = productName;
        this.serialNumber = serialNumber;
        this.vendorId = vendorId;
        this.productId = productId;
        this.address = address;
        this.port = port;
    }


    /**
     * Returns the transport used to discover the device.
     *
     * @return connection type
     */
    public ConnectionType getConnectionType() {
        return connectionType;
    }


    /**
     * Returns the device name.
     *
     * @return device name
     */
    public String getDeviceName() {
        return deviceName;
    }


    /**
     * Returns the manufacturer name.
     *
     * @return manufacturer name
     */
    public String getManufacturer() {
        return manufacturer;
    }


    /**
     * Returns the product name.
     *
     * @return product name
     */
    public String getProductName() {
        return productName;
    }


    /**
     * Returns the hardware serial number.
     *
     * @return serial number or null
     */
    public String getSerialNumber() {
        return serialNumber;
    }


    /**
     * Returns the USB vendor ID.
     *
     * @return vendor ID or null
     */
    public Integer getVendorId() {
        return vendorId;
    }


    /**
     * Returns the USB product ID.
     *
     * @return product ID or null
     */
    public Integer getProductId() {
        return productId;
    }


    /**
     * Returns the Bluetooth address or network host.
     *
     * @return address or host
     */
    public String getAddress() {
        return address;
    }


    /**
     * Returns the network port.
     *
     * @return port or null
     */
    public Integer getPort() {
        return port;
    }
}

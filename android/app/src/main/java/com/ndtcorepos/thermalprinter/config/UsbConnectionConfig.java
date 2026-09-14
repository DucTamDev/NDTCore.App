package com.ndtcorepos.thermalprinter.config;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Contains the configuration required to identify a USB printer connection.
 */
public final class UsbConnectionConfig
        implements IPrinterConnectionConfig {

    /**
     * USB vendor identifier used to identify the device.
     */
    private final int vendorId;

    /**
     * USB product identifier used to identify the device.
     */
    private final int productId;

    /**
     * Optional USB serial number used to distinguish devices with
     * identical vendor and product IDs.
     */
    private final String serialNumber;


    /**
     * Creates a USB connection configuration.
     *
     * @param vendorId USB vendor ID
     * @param productId USB product ID
     * @param serialNumber optional USB serial number
     */
    public UsbConnectionConfig(
            int vendorId,
            int productId,
            String serialNumber
    ) {
        this.vendorId = vendorId;
        this.productId = productId;
        this.serialNumber = serialNumber;
    }


    /**
     * Returns the configured transport type.
     *
     * @return USB
     */
    @Override
    public ConnectionType getConnectionType() {
        return ConnectionType.USB;
    }


    /**
     * Returns the USB vendor ID.
     *
     * @return vendor ID
     */
    public int getVendorId() {
        return vendorId;
    }


    /**
     * Returns the USB product ID.
     *
     * @return product ID
     */
    public int getProductId() {
        return productId;
    }


    /**
     * Returns the configured serial number.
     *
     * @return serial number or null
     */
    public String getSerialNumber() {
        return serialNumber;
    }
}

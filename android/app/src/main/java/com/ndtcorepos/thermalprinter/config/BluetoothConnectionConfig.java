package com.ndtcorepos.thermalprinter.config;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Contains the configuration required to connect to a Bluetooth printer.
 */
public final class BluetoothConnectionConfig
        implements IPrinterConnectionConfig {

    /**
     * Bluetooth MAC address of the target printer.
     */
    private final String macAddress;


    /**
     * Creates a Bluetooth connection configuration.
     *
     * @param macAddress Bluetooth MAC address
     */
    public BluetoothConnectionConfig(
            String macAddress
    ) {
        this.macAddress = macAddress;
    }


    /**
     * Returns the configured transport type.
     *
     * @return Bluetooth
     */
    @Override
    public ConnectionType getConnectionType() {
        return ConnectionType.BLUETOOTH;
    }


    /**
     * Returns the Bluetooth MAC address.
     *
     * @return MAC address
     */
    public String getMacAddress() {
        return macAddress;
    }
}

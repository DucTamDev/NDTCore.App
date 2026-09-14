package com.ndtcorepos.thermalprinter.config;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Defines configuration required to establish one printer connection.
 *
 * Connection configuration contains transport information only.
 * It does not contain printer type, driver, paper, rendering,
 * encoding, or printing business configuration.
 */
public interface IPrinterConnectionConfig {

    /**
     * Returns the transport type represented by this configuration.
     *
     * @return connection type
     */
    ConnectionType getConnectionType();
}

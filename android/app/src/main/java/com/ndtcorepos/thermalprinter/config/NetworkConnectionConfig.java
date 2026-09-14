package com.ndtcorepos.thermalprinter.config;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Contains the configuration required to connect to a network printer.
 */
public final class NetworkConnectionConfig
        implements IPrinterConnectionConfig {

    /**
     * Hostname or IP address of the target printer.
     */
    private final String host;

    /**
     * TCP port used by the printer.
     */
    private final int port;


    /**
     * Creates a network connection configuration.
     *
     * @param host printer hostname or IP address
     * @param port printer TCP port
     */
    public NetworkConnectionConfig(
            String host,
            int port
    ) {
        this.host = host;
        this.port = port;
    }


    /**
     * Returns the configured transport type.
     *
     * @return network
     */
    @Override
    public ConnectionType getConnectionType() {
        return ConnectionType.NETWORK;
    }


    /**
     * Returns the printer hostname or IP address.
     *
     * @return printer host
     */
    public String getHost() {
        return host;
    }


    /**
     * Returns the printer TCP port.
     *
     * @return TCP port
     */
    public int getPort() {
        return port;
    }
}

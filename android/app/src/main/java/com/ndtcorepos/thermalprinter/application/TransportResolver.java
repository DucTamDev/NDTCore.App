package com.ndtcorepos.thermalprinter.application;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

import java.util.Map;

public final class TransportResolver {

    private final Map<ConnectionType, IPrinterTransport> transports;

    public TransportResolver(Map<ConnectionType, IPrinterTransport> transports) {
        this.transports = transports;
    }

    public IPrinterTransport resolve(ConnectionType type) throws PrinterException {
        IPrinterTransport transport = transports.get(type);
        if (transport == null) {
            throw new PrinterException(PrinterErrorCode.UNSUPPORTED_CONNECTION, "Unsupported connection type: " + type);
        }
        return transport;
    }
}

package com.ndtcorepos.thermalprinter.application;

import android.os.SystemClock;
import android.util.Log;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.model.IPrinterDevice;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

import java.util.List;
import java.util.Map;

public final class PrinterService {

    private static final String TAG = "PrinterService";

    private final Map<ConnectionType, IPrinterTransport> transports;
    private final Map<ConnectionType, IPrinterDiscovery> discoveries;

    public PrinterService(Map<ConnectionType, IPrinterTransport> transports, Map<ConnectionType, IPrinterDiscovery> discoveries) {
        this.transports = transports;
        this.discoveries = discoveries;
    }

    private IPrinterTransport resolveTransport(ConnectionType type) throws PrinterException {
        IPrinterTransport transport = transports.get(type);
        if (transport == null) {
            throw new PrinterException(PrinterErrorCode.UNSUPPORTED_CONNECTION, "Unsupported connection type: " + type);
        }
        return transport;
    }

    public List<IPrinterDevice> discover(ConnectionType type) throws PrinterException {
        IPrinterDiscovery discovery = discoveries.get(type);
        if (discovery == null) {
            throw new PrinterException(PrinterErrorCode.UNSUPPORTED_CONNECTION, "Discovery not supported for: " + type);
        }
        return discovery.discover();
    }

    public void connect(PrinterConnection connection) throws PrinterException {
        resolveTransport(connection.type()).connect(connection);
    }

    public WriteResult write(ConnectionType type, PrinterData data, boolean keepConnection) throws PrinterException {
        long startedAt = SystemClock.elapsedRealtime();
        IPrinterTransport transport = resolveTransport(type);

        transport.write(data);
        if (!keepConnection) {
            transport.disconnect();
        }

        long durationMs = SystemClock.elapsedRealtime() - startedAt;
        Log.i(TAG, "operation=write connection=" + type + " bytes=" + data.size() + " durationMs=" + durationMs + " result=success");
        return new WriteResult(data.size(), durationMs);
    }

    public void disconnect(ConnectionType type) throws PrinterException {
        resolveTransport(type).disconnect();
    }
}

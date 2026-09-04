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

    private final TransportResolver transportResolver;
    private final Map<ConnectionType, IPrinterDiscovery> discoveries;

    public PrinterService(TransportResolver transportResolver, Map<ConnectionType, IPrinterDiscovery> discoveries) {
        this.transportResolver = transportResolver;
        this.discoveries = discoveries;
    }

    public List<IPrinterDevice> discover(ConnectionType type) throws PrinterException {
        IPrinterDiscovery discovery = discoveries.get(type);
        if (discovery == null) {
            throw new PrinterException(PrinterErrorCode.UNSUPPORTED_CONNECTION, "Discovery not supported for: " + type);
        }
        return discovery.discover();
    }

    public void connect(PrinterConnection connection) throws PrinterException {
        ConnectionType type;
        if (connection instanceof PrinterConnection.Usb) {
            type = ConnectionType.USB;
        } else if (connection instanceof PrinterConnection.Bluetooth) {
            type = ConnectionType.BLUETOOTH;
        } else if (connection instanceof PrinterConnection.Lan) {
            type = ConnectionType.LAN;
        } else {
            throw new PrinterException(PrinterErrorCode.UNSUPPORTED_CONNECTION, "Unsupported connection: " + connection);
        }
        transportResolver.resolve(type).connect(connection);
    }

    public WriteResult write(ConnectionType type, PrinterData data, boolean keepConnection) throws PrinterException {
        long startedAt = SystemClock.elapsedRealtime();
        IPrinterTransport transport = transportResolver.resolve(type);

        transport.write(data);
        if (!keepConnection) {
            transport.disconnect();
        }

        long durationMs = SystemClock.elapsedRealtime() - startedAt;
        Log.i(TAG, "operation=write connection=" + type + " bytes=" + data.size() + " durationMs=" + durationMs + " result=success");
        return new WriteResult(data.size(), durationMs);
    }

    public void disconnect(ConnectionType type) throws PrinterException {
        transportResolver.resolve(type).disconnect();
    }
}

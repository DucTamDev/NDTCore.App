package com.ndtcorepos.thermalprinter.transport;

import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;

public interface IPrinterTransport {
    void connect(PrinterConnection connection) throws PrinterException;
    void write(PrinterData data) throws PrinterException;
    void disconnect();
    boolean isConnected();
}

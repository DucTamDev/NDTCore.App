package com.ndtcorepos.thermalprinter.discovery;

import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.IPrinterDevice;

import java.util.List;

public interface IPrinterDiscovery {
    List<IPrinterDevice> discover() throws PrinterException;
}

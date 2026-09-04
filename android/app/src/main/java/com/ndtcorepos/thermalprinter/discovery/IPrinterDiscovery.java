package com.ndtcorepos.thermalprinter.discovery;

import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;

import java.util.List;

public interface IPrinterDiscovery {
    List<PrinterDevice> discover() throws PrinterException;
}

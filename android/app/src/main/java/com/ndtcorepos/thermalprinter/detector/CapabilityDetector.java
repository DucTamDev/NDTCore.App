package com.ndtcorepos.thermalprinter.detector;

import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

/**
 * Phát hiện capability quan sát được từ native — không suy đoán, không biết protocol.
 */
public interface CapabilityDetector {

    /**
     * Phát hiện capability cho 1 printer.
     *
     * @param info metadata printer
     */
    PrinterCapabilities detect(PrinterInfo info);
}

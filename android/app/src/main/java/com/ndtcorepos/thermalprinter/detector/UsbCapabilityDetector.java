package com.ndtcorepos.thermalprinter.detector;

import com.ndtcorepos.thermalprinter.printer.CapabilityState;
import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

/**
 * ICapabilityDetector cho printer USB — chưa có logic đọc status thật, trả UNKNOWN.
 */
public final class UsbCapabilityDetector implements ICapabilityDetector {

    @Override
    public PrinterCapabilities detect(PrinterInfo info) {
        return new PrinterCapabilities(CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN);
    }
}

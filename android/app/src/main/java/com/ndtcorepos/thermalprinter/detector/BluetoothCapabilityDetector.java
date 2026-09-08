package com.ndtcorepos.thermalprinter.detector;

import com.ndtcorepos.thermalprinter.printer.CapabilityState;
import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

/**
 * CapabilityDetector cho printer Bluetooth — chưa có logic đọc status thật, trả UNKNOWN.
 */
public final class BluetoothCapabilityDetector implements CapabilityDetector {

    @Override
    public PrinterCapabilities detect(PrinterInfo info) {
        return new PrinterCapabilities(CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN);
    }
}

package com.ndtcorepos.thermalprinter.printer;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Metadata bất biến mô tả 1 printer.
 */
public record PrinterInfo(
        String printerId,
        ConnectionType connectionType,
        String name,
        String manufacturerName,
        String productName,
        Integer vendorId,
        Integer productId,
        String serialNumber,
        String bluetoothAddress,
        String host,
        Integer port) {
}

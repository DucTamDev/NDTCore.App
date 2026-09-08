package com.ndtcorepos.thermalprinter.printer;

/**
 * Khả năng của printer mà native có thể quan sát được — không mô tả protocol.
 */
public record PrinterCapabilities(
        CapabilityState rawWrite,
        CapabilityState paperStatus,
        CapabilityState coverStatus,
        CapabilityState printerStatus) {
}

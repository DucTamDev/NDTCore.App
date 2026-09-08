package com.ndtcorepos.thermalprinter.printer;

/**
 * Mức độ chắc chắn của 1 capability đã detect.
 */
public enum CapabilityState {
    /** Chắc chắn hỗ trợ. */
    SUPPORTED,
    /** Chắc chắn không hỗ trợ. */
    UNSUPPORTED,
    /** Native không xác định được — KHÔNG suy ra là không hỗ trợ. */
    UNKNOWN
}

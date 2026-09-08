package com.ndtcorepos.thermalprinter.exception;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Vượt quá thời gian chờ (connect/write/socket).
 */
public class PrinterTimeoutException extends PrinterException {

    public PrinterTimeoutException(PrinterErrorCode code, String message) {
        super(code, message);
    }

    public PrinterTimeoutException(PrinterErrorCode code, String message, Throwable cause) {
        super(code, message, cause);
    }
}

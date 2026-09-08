package com.ndtcorepos.thermalprinter.exception;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Lỗi liên quan permission Android (USB).
 */
public class PrinterPermissionException extends PrinterException {

    public PrinterPermissionException(PrinterErrorCode code, String message) {
        super(code, message);
    }

    public PrinterPermissionException(PrinterErrorCode code, String message, Throwable cause) {
        super(code, message, cause);
    }
}

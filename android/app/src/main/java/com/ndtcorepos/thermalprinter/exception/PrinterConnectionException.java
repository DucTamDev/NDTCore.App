package com.ndtcorepos.thermalprinter.exception;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Lỗi khi mở/đóng kết nối.
 */
public class PrinterConnectionException extends PrinterException {

    public PrinterConnectionException(PrinterErrorCode code, String message) {
        super(code, message);
    }

    public PrinterConnectionException(PrinterErrorCode code, String message, Throwable cause) {
        super(code, message, cause);
    }
}

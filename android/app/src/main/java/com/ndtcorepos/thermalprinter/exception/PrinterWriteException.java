package com.ndtcorepos.thermalprinter.exception;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Lỗi khi ghi dữ liệu.
 */
public class PrinterWriteException extends PrinterException {

    public PrinterWriteException(PrinterErrorCode code, String message) {
        super(code, message);
    }

    public PrinterWriteException(PrinterErrorCode code, String message, Throwable cause) {
        super(code, message, cause);
    }
}

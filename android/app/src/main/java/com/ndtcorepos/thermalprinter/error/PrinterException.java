package com.ndtcorepos.thermalprinter.error;

/** Exception nội bộ tầng native — không tự log, layer tạo ra nó chịu trách nhiệm log nếu cần. */
public class PrinterException extends Exception {

    private final PrinterErrorCode code;

    public PrinterException(PrinterErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public PrinterException(PrinterErrorCode code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

}

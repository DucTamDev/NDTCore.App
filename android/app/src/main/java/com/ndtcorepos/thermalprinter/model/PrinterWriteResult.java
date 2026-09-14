package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;

/**
 * Represents the result of a printer operation.
 *
 * Expected printer and transport failures are returned through this class
 * instead of requiring callers to catch exceptions.
 */
public final class PrinterWriteResult {

    /**
     * Indicates whether the operation completed successfully.
     */
    private final boolean success;

    /**
     * Expected error code returned when the operation fails.
     */
    private final PrinterErrorCode errorCode;

    /**
     * Number of bytes successfully transmitted before the operation completed
     * or failed.
     */
    private final int bytesWritten;


    private PrinterWriteResult(
            boolean success,
            PrinterErrorCode errorCode,
            int bytesWritten
    ) {
        this.success = success;
        this.errorCode = errorCode;
        this.bytesWritten = bytesWritten;
    }


    /**
     * Creates a successful operation result.
     *
     * @param bytesWritten number of bytes transmitted
     * @return successful result
     */
    public static PrinterWriteResult success(
            int bytesWritten
    ) {
        return new PrinterWriteResult(
                true,
                PrinterErrorCode.NONE,
                bytesWritten
        );
    }


    /**
     * Creates a failed operation result.
     *
     * @param errorCode expected printer error
     * @param bytesWritten number of bytes transmitted before failure
     * @return failed result
     */
    public static PrinterWriteResult failure(
            PrinterErrorCode errorCode,
            int bytesWritten
    ) {
        return new PrinterWriteResult(
                false,
                errorCode,
                bytesWritten
        );
    }


    /**
     * Returns whether the operation succeeded.
     *
     * @return true when successful
     */
    public boolean isSuccess() {
        return success;
    }


    /**
     * Returns the operation error code.
     *
     * @return error code
     */
    public PrinterErrorCode getErrorCode() {
        return errorCode;
    }


    /**
     * Returns the number of bytes transmitted.
     *
     * @return bytes written
     */
    public int getBytesWritten() {
        return bytesWritten;
    }
}

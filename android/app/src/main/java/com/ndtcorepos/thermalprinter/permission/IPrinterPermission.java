package com.ndtcorepos.thermalprinter.permission;

import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Defines permission operations required by a printer transport.
 *
 * Only transports that require an Android permission should implement
 * a concrete permission handler.
 */
public interface IPrinterPermission {

    /**
     * Checks whether the required transport permission is already granted.
     *
     * @return true when permission is available
     */
    boolean hasPermission();


    /**
     * Starts the permission request flow.
     *
     * @return operation result
     */
    PrinterWriteResult requestPermission();
}

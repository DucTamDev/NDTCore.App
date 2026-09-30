package com.ndtcorepos.thermalprinter.identity;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

/**
 * Creates a runtime connection identity from discovered device information.
 */
public interface IConnectionIdentityResolver {

    /**
     * Resolves the runtime identity of a discovered connection.
     *
     * @param descriptor discovered printer descriptor
     * @return connection identity
     */
    ConnectionIdentity resolve(
            PrinterDescriptor descriptor
    );
}

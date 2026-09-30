package com.ndtcorepos.thermalprinter.identity.usb;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.enums.IdentityStability;
import com.ndtcorepos.thermalprinter.identity.IConnectionIdentityResolver;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

/**
 * Resolves runtime identities for USB devices.
 *
 * A USB serial number is preferred because it normally remains stable
 * across reconnects.
 */
public final class UsbConnectionIdentityResolver
        implements IConnectionIdentityResolver {

    /**
     * Creates a stable or temporary identity from USB device information.
     *
     * @param descriptor discovered USB device
     * @return USB connection identity
     */
    @Override
    public ConnectionIdentity resolve(
            PrinterDescriptor descriptor
    ) {
        String serialNumber =
                descriptor.getSerialNumber();

        if (serialNumber != null
                && !serialNumber.isEmpty()) {

            return new ConnectionIdentity(
                    "USB:"
                            + descriptor.getVendorId()
                            + ":"
                            + descriptor.getProductId()
                            + ":"
                            + serialNumber,
                    ConnectionType.USB,
                    IdentityStability.STABLE
            );
        }

        return new ConnectionIdentity(
                "USB:"
                        + descriptor.getVendorId()
                        + ":"
                        + descriptor.getProductId()
                        + ":"
                        + descriptor.getDeviceName(),
                ConnectionType.USB,
                IdentityStability.TEMPORARY
        );
    }
}

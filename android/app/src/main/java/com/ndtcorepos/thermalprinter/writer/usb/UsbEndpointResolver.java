package com.ndtcorepos.thermalprinter.writer.usb;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;

/**
 * Resolves the USB bulk OUT endpoint used to send printer data.
 *
 * This class only inspects the USB interface.
 * It does not open the connection and does not perform transfers.
 */
public final class UsbEndpointResolver {

    /**
     * Finds the first bulk OUT endpoint available on the interface.
     *
     * @param usbInterface USB interface containing printer endpoints
     * @return bulk OUT endpoint or null when none exists
     */
    public UsbEndpoint resolve(
            UsbInterface usbInterface
    ) {
        for (int index = 0;
             index < usbInterface.getEndpointCount();
             index++) {

            UsbEndpoint endpoint =
                    usbInterface.getEndpoint(index);

            if (endpoint.getType()
                    == UsbConstants.USB_ENDPOINT_XFER_BULK
                    && endpoint.getDirection()
                    == UsbConstants.USB_DIR_OUT) {

                return endpoint;
            }
        }

        return null;
    }
}

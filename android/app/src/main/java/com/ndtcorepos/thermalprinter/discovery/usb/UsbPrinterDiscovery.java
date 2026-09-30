package com.ndtcorepos.thermalprinter.discovery.usb;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;
import com.ndtcorepos.thermalprinter.writer.usb.UsbEndpointResolver;

import java.util.ArrayList;
import java.util.List;

/**
 * Discovers USB devices available through Android UsbManager.
 *
 * Discovery does not open the devices and does not request permission.
 */
public final class UsbPrinterDiscovery
        implements IPrinterDiscovery {

    /**
     * Android USB manager used to enumerate connected devices.
     */
    private final UsbManager usbManager;

    /**
     * Endpoint resolver used to tell candidate printers from other USB devices.
     */
    private final UsbEndpointResolver endpointResolver;


    /**
     * Creates a USB printer discovery service.
     *
     * @param context Android application context
     * @param endpointResolver bulk OUT endpoint resolver
     */
    public UsbPrinterDiscovery(
            Context context,
            UsbEndpointResolver endpointResolver
    ) {
        usbManager =
                (UsbManager) context.getSystemService(
                        Context.USB_SERVICE
                );
        this.endpointResolver = endpointResolver;
    }


    /**
     * Returns the currently connected USB devices that look like printers.
     *
     * @return discovered USB printer descriptors
     */
    @Override
    public List<PrinterDescriptor> discover() {

        List<PrinterDescriptor> devices =
                new ArrayList<>();

        for (UsbDevice device :
                usbManager.getDeviceList().values()) {

            if (isPrintable(device)) {
                devices.add(
                        createDescriptor(device)
                );
            }
        }

        return devices;
    }


    /**
     * A USB device is a candidate printer if any of its interfaces exposes a
     * bulk OUT endpoint — the same predicate UsbEndpointResolver applies when
     * actually opening a connection, so discovery and connect agree on what
     * counts as printable.
     *
     * @param device Android USB device
     * @return true when the device exposes a bulk OUT endpoint
     */
    private boolean isPrintable(UsbDevice device) {
        for (int index = 0; index < device.getInterfaceCount(); index++) {
            if (endpointResolver.resolve(device.getInterface(index)) != null) {
                return true;
            }
        }

        return false;
    }


    /**
     * Converts an Android UsbDevice into a transport-neutral descriptor.
     *
     * @param device Android USB device
     * @return printer descriptor
     */
    private PrinterDescriptor createDescriptor(
            UsbDevice device
    ) {
        return new PrinterDescriptor(
                ConnectionType.USB,
                device.getDeviceName(),
                device.getManufacturerName(),
                device.getProductName(),
                getSerialNumber(device),
                device.getVendorId(),
                device.getProductId(),
                null,
                null
        );
    }


    /**
     * Reads the USB serial number when available.
     *
     * @param device Android USB device
     * @return serial number or null
     */
    private String getSerialNumber(
            UsbDevice device
    ) {
        try {
            return device.getSerialNumber();
        } catch (SecurityException exception) {
            return null;
        }
    }
}

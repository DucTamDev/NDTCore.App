package com.ndtcorepos.thermalprinter.discovery.usb;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

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
     * Creates a USB printer discovery service.
     *
     * @param context Android application context
     */
    public UsbPrinterDiscovery(
            Context context
    ) {
        usbManager =
                (UsbManager) context.getSystemService(
                        Context.USB_SERVICE
                );
    }


    /**
     * Returns all currently connected USB devices as descriptors.
     *
     * @return discovered USB device descriptors
     */
    @Override
    public List<PrinterDescriptor> discover() {

        List<PrinterDescriptor> devices =
                new ArrayList<>();

        for (UsbDevice device :
                usbManager.getDeviceList().values()) {

            devices.add(
                    createDescriptor(device)
            );
        }

        return devices;
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

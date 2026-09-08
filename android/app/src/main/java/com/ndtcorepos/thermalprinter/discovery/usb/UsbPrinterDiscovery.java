package com.ndtcorepos.thermalprinter.discovery.usb;

import android.content.Context;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * Quét thiết bị USB có bulk OUT endpoint và dựng PrinterInfo tương ứng.
 */
public final class UsbPrinterDiscovery implements IPrinterDiscovery {

    private final UsbManager usbManager;

    public UsbPrinterDiscovery(ReactApplicationContext context) {
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    @Override
    public List<PrinterInfo> discover() throws PrinterException {
        if (usbManager == null) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "USBManager is not available");
        }

        List<PrinterInfo> devices = new ArrayList<>();

        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (isPrintableUsbDevice(device)) {
                devices.add(toPrinterInfo(device));
            }
        }

        return devices;
    }

    private PrinterInfo toPrinterInfo(UsbDevice device) {
        String name = resolveDisplayName(device);
        String serialNumber = getSerialNumberSafely(device);

        return new PrinterInfo(
                null,
                ConnectionType.USB,
                name,
                device.getManufacturerName(),
                device.getProductName(),
                device.getVendorId(),
                device.getProductId(),
                serialNumber,
                null,
                null,
                null);
    }

    private String resolveDisplayName(UsbDevice device) {
        if (device.getProductName() != null) {
            return device.getProductName();
        }

        if (device.getManufacturerName() != null) {
            return device.getManufacturerName();
        }

        return device.getDeviceName();
    }

    /**
     * Đọc serial number qua UsbDevice.getSerialNumber() — từ Android 10 trở
     * lên, API này ném SecurityException nếu app chưa có quyền USB, nên phải
     * bọc try/catch và coi như không có serial thay vì làm hỏng cả lần quét.
     */
    private String getSerialNumberSafely(UsbDevice device) {
        try {
            return device.getSerialNumber();
        } catch (SecurityException ignored) {
            return null;
        }
    }

    /** Dùng lại ở UsbConnection để resolve UsbDevice theo vendorId/productId. */
    public static boolean isPrintableUsbDevice(UsbDevice device) {
        if (device == null || device.getVendorId() < 0 || device.getProductId() < 0) {
            return false;
        }

        return findBulkOutInterface(device) != null;
    }

    public static UsbInterface findBulkOutInterface(UsbDevice device) {
        if (device == null) {
            return null;
        }

        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface usbInterface = device.getInterface(i);
            if (findBulkOutEndpoint(usbInterface) != null) {
                return usbInterface;
            }
        }

        return null;
    }

    public static UsbEndpoint findBulkOutEndpoint(UsbInterface usbInterface) {
        if (usbInterface == null) {
            return null;
        }

        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(i);
            if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK
                    && endpoint.getDirection() == UsbConstants.USB_DIR_OUT) {
                return endpoint;
            }
        }

        return null;
    }
}

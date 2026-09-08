package com.ndtcorepos.thermalprinter.transport.usb;

import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;

import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;

/**
 * Tìm bulk OUT endpoint hợp lệ để ghi dữ liệu tới printer.
 */
public final class UsbEndpointResolver {

    /**
     * Tìm interface có bulk OUT endpoint.
     *
     * @param device thiết bị USB
     * @return interface đã resolve
     * @throws PrinterConnectionException USB_ENDPOINT_NOT_FOUND khi không tìm thấy interface hợp lệ
     */
    public UsbInterface resolveInterface(UsbDevice device) throws PrinterConnectionException {
        UsbInterface usbInterface = UsbPrinterDiscovery.findBulkOutInterface(device);

        if (usbInterface == null) {
            throw new PrinterConnectionException(PrinterErrorCode.USB_ENDPOINT_NOT_FOUND, "USB device has no bulk OUT endpoint");
        }

        return usbInterface;
    }

    /**
     * Tìm endpoint OUT trong 1 interface đã resolve.
     *
     * @param usbInterface interface đã tìm qua resolveInterface
     * @return endpoint OUT
     * @throws PrinterConnectionException USB_ENDPOINT_NOT_FOUND khi không tìm thấy endpoint hợp lệ
     */
    public UsbEndpoint resolveEndpoint(UsbInterface usbInterface) throws PrinterConnectionException {
        UsbEndpoint endpoint = UsbPrinterDiscovery.findBulkOutEndpoint(usbInterface);

        if (endpoint == null) {
            throw new PrinterConnectionException(PrinterErrorCode.USB_ENDPOINT_NOT_FOUND, "USB interface has no bulk OUT endpoint");
        }

        return endpoint;
    }
}

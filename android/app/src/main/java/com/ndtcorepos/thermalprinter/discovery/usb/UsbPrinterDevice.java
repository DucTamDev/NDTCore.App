package com.ndtcorepos.thermalprinter.discovery.usb;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;
import com.ndtcorepos.thermalprinter.model.PrinterDeviceId;

public final class UsbPrinterDevice implements PrinterDevice {

    private final UsbDevice device;
    private final UsbPrinterDeviceId deviceId;

    public UsbPrinterDevice(UsbDevice device) {
        if (device == null) {
            throw new IllegalArgumentException("USB device must not be null");
        }
        this.device = device;
        this.deviceId = UsbPrinterDeviceId.valueOf(device.getVendorId(), device.getProductId());
    }

    @Override
    public PrinterDeviceId getPrinterDeviceId() {
        return deviceId;
    }

    /** Native-only access. Do not expose UsbDevice directly to React Native. */
    public UsbDevice getUsbDevice() {
        return device;
    }

    @Override
    public WritableMap toWritableMap() {
        WritableMap map = Arguments.createMap();
        putDeviceInfo(map);
        putDescriptorInfo(map);
        putInterfaces(map);
        return map;
    }

    private void putDeviceInfo(WritableMap map) {
        map.putString("deviceName", device.getDeviceName());
        map.putInt("deviceId", device.getDeviceId());
        map.putInt("vendorId", device.getVendorId());
        map.putInt("productId", device.getProductId());

        putStringOrNull(map, "manufacturerName", device.getManufacturerName());
        putStringOrNull(map, "productName", device.getProductName());
        putStringOrNull(map, "version", getVersionSafely());
        putStringOrNull(map, "serialNumber", getSerialNumberSafely());
    }

    private void putDescriptorInfo(WritableMap map) {
        map.putInt("deviceClass", device.getDeviceClass());
        map.putInt("deviceSubclass", device.getDeviceSubclass());
        map.putInt("deviceProtocol", device.getDeviceProtocol());
    }

    private void putInterfaces(WritableMap map) {
        WritableArray interfaces = Arguments.createArray();
        boolean hasBulkIn = false;
        boolean hasBulkOut = false;

        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface usbInterface = device.getInterface(i);
            interfaces.pushMap(toInterfaceMap(usbInterface));

            if (hasBulkEndpoint(usbInterface, UsbConstants.USB_DIR_IN)) {
                hasBulkIn = true;
            }
            if (hasBulkEndpoint(usbInterface, UsbConstants.USB_DIR_OUT)) {
                hasBulkOut = true;
            }
        }

        map.putArray("interfaces", interfaces);
        map.putBoolean("hasBulkInEndpoint", hasBulkIn);
        map.putBoolean("hasBulkOutEndpoint", hasBulkOut);
    }

    private WritableMap toInterfaceMap(UsbInterface usbInterface) {
        WritableMap map = Arguments.createMap();
        map.putInt("id", usbInterface.getId());
        map.putInt("alternateSetting", usbInterface.getAlternateSetting());
        map.putInt("class", usbInterface.getInterfaceClass());
        map.putInt("subclass", usbInterface.getInterfaceSubclass());
        map.putInt("protocol", usbInterface.getInterfaceProtocol());
        putStringOrNull(map, "name", usbInterface.getName());

        WritableArray endpoints = Arguments.createArray();
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            endpoints.pushMap(toEndpointMap(usbInterface.getEndpoint(i)));
        }
        map.putInt("endpointCount", usbInterface.getEndpointCount());
        map.putArray("endpoints", endpoints);
        return map;
    }

    private WritableMap toEndpointMap(UsbEndpoint endpoint) {
        WritableMap map = Arguments.createMap();
        map.putInt("address", endpoint.getAddress());
        map.putInt("number", endpoint.getEndpointNumber());
        map.putString("direction", getDirectionName(endpoint.getDirection()));
        map.putString("type", getEndpointTypeName(endpoint.getType()));
        map.putInt("maxPacketSize", endpoint.getMaxPacketSize());
        map.putInt("interval", endpoint.getInterval());
        return map;
    }

    private boolean hasBulkEndpoint(UsbInterface usbInterface, int direction) {
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(i);
            if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.getDirection() == direction) {
                return true;
            }
        }
        return false;
    }

    private String getDirectionName(int direction) {
        if (direction == UsbConstants.USB_DIR_IN) return "in";
        if (direction == UsbConstants.USB_DIR_OUT) return "out";
        return "unknown";
    }

    private String getEndpointTypeName(int type) {
        switch (type) {
            case UsbConstants.USB_ENDPOINT_XFER_CONTROL: return "control";
            case UsbConstants.USB_ENDPOINT_XFER_ISOC: return "isochronous";
            case UsbConstants.USB_ENDPOINT_XFER_BULK: return "bulk";
            case UsbConstants.USB_ENDPOINT_XFER_INT: return "interrupt";
            default: return "unknown";
        }
    }

    private String getVersionSafely() {
        try {
            return device.getVersion();
        } catch (SecurityException ignored) {
            return null;
        }
    }

    private String getSerialNumberSafely() {
        try {
            return device.getSerialNumber();
        } catch (SecurityException ignored) {
            return null;
        }
    }

    private void putStringOrNull(WritableMap map, String key, String value) {
        if (value == null) {
            map.putNull(key);
        } else {
            map.putString(key, value);
        }
    }
}

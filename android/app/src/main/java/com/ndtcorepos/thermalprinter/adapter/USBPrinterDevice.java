package com.ndtcorepos.thermalprinter.adapter;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

/**
 * Created by xiesubin on 2017/9/21.
 *
 * `toRNWritableMap()` trả TOÀN BỘ USB descriptor (manufacturer/product/serial +
 * mọi interface/endpoint) chứ không chỉ vendor/product id — thay cho native
 * module `UsbDeviceInfo` (Kotlin) đã bỏ. Không giả định interface 0 là printer:
 * quét mọi interface, trả nguyên cấu trúc lồng cho JS tự quyết.
 */
public class USBPrinterDevice implements PrinterDevice {
    private UsbDevice mDevice;
    private USBPrinterDeviceId usbPrinterDeviceId;

    public USBPrinterDevice(UsbDevice device) {
        this.usbPrinterDeviceId = USBPrinterDeviceId.valueOf(device.getVendorId(), device.getProductId());
        this.mDevice = device;
    }

    @Override
    public PrinterDeviceId getPrinterDeviceId() {
        return this.usbPrinterDeviceId;
    }

    public UsbDevice getUsbDevice() {
        return this.mDevice;
    }

    @Override
    public WritableMap toRNWritableMap() {
        WritableMap deviceMap = Arguments.createMap();
        deviceMap.putString("device_name", this.mDevice.getDeviceName());
        deviceMap.putInt("device_id", this.mDevice.getDeviceId());
        deviceMap.putInt("vendor_id", this.mDevice.getVendorId());
        deviceMap.putInt("product_id", this.mDevice.getProductId());

        putStringOrNull(deviceMap, "manufacturerName", this.mDevice.getManufacturerName());
        putStringOrNull(deviceMap, "productName", this.mDevice.getProductName());
        putStringOrNull(deviceMap, "version", safeVersion());
        putStringOrNull(deviceMap, "serialNumber", safeSerialNumber());
        deviceMap.putInt("deviceClass", this.mDevice.getDeviceClass());
        deviceMap.putInt("deviceSubclass", this.mDevice.getDeviceSubclass());
        deviceMap.putInt("deviceProtocol", this.mDevice.getDeviceProtocol());

        boolean hasBulkIn = false;
        boolean hasBulkOut = false;
        WritableArray interfaces = Arguments.createArray();
        for (int i = 0; i < this.mDevice.getInterfaceCount(); i++) {
            UsbInterface usbInterface = this.mDevice.getInterface(i);
            interfaces.pushMap(describeInterface(usbInterface));
            for (int j = 0; j < usbInterface.getEndpointCount(); j++) {
                UsbEndpoint endpoint = usbInterface.getEndpoint(j);
                if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                    if (endpoint.getDirection() == UsbConstants.USB_DIR_IN) hasBulkIn = true;
                    if (endpoint.getDirection() == UsbConstants.USB_DIR_OUT) hasBulkOut = true;
                }
            }
        }
        deviceMap.putArray("interfaces", interfaces);
        deviceMap.putBoolean("hasBulkInEndpoint", hasBulkIn);
        deviceMap.putBoolean("hasBulkOutEndpoint", hasBulkOut);
        return deviceMap;
    }

    private WritableMap describeInterface(UsbInterface usbInterface) {
        WritableMap map = Arguments.createMap();
        map.putInt("id", usbInterface.getId());
        map.putInt("alternateSetting", usbInterface.getAlternateSetting());
        map.putInt("class", usbInterface.getInterfaceClass());
        map.putInt("subclass", usbInterface.getInterfaceSubclass());
        map.putInt("protocol", usbInterface.getInterfaceProtocol());
        putStringOrNull(map, "name", usbInterface.getName());
        WritableArray endpoints = Arguments.createArray();
        for (int j = 0; j < usbInterface.getEndpointCount(); j++) {
            endpoints.pushMap(describeEndpoint(usbInterface.getEndpoint(j)));
        }
        map.putArray("endpoints", endpoints);
        return map;
    }

    private WritableMap describeEndpoint(UsbEndpoint endpoint) {
        WritableMap map = Arguments.createMap();
        map.putInt("address", endpoint.getAddress());
        map.putInt("number", endpoint.getEndpointNumber());
        map.putString("direction", endpoint.getDirection() == UsbConstants.USB_DIR_IN ? "in" : "out");
        map.putString("type", endpointTypeName(endpoint.getType()));
        map.putInt("maxPacketSize", endpoint.getMaxPacketSize());
        map.putInt("interval", endpoint.getInterval());
        return map;
    }

    private String endpointTypeName(int type) {
        switch (type) {
            case UsbConstants.USB_ENDPOINT_XFER_CONTROL:
                return "control";
            case UsbConstants.USB_ENDPOINT_XFER_ISOC:
                return "isochronous";
            case UsbConstants.USB_ENDPOINT_XFER_BULK:
                return "bulk";
            case UsbConstants.USB_ENDPOINT_XFER_INT:
                return "interrupt";
            default:
                return "unknown";
        }
    }

    private void putStringOrNull(WritableMap map, String key, String value) {
        if (value == null) {
            map.putNull(key);
        } else {
            map.putString(key, value);
        }
    }

    private String safeVersion() {
        try {
            return this.mDevice.getVersion();
        } catch (Exception e) {
            return null;
        }
    }

    // Android 10+ ném SecurityException nếu app chưa được cấp quyền cho thiết bị này.
    private String safeSerialNumber() {
        try {
            return this.mDevice.getSerialNumber();
        } catch (SecurityException e) {
            return null;
        }
    }
}

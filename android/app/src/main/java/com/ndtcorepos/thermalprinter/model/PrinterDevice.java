package com.ndtcorepos.thermalprinter.model;

import com.facebook.react.bridge.WritableMap;

/**
 * 1 thiết bị máy in do discovery tìm thấy. Mỗi ConnectionType có 1
 * implementation cụ thể sống cùng discovery class tạo ra nó
 * (vd `UsbPrinterDevice` trong `discovery.usb`).
 */
public interface PrinterDevice {
    PrinterDeviceId getPrinterDeviceId();
    WritableMap toWritableMap();
}

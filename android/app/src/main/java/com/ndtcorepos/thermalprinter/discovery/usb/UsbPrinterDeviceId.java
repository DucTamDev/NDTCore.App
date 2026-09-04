package com.ndtcorepos.thermalprinter.discovery.usb;

import com.ndtcorepos.thermalprinter.model.PrinterDeviceId;

public final class UsbPrinterDeviceId extends PrinterDeviceId {

    private final int vendorId;
    private final int productId;

    public static UsbPrinterDeviceId valueOf(int vendorId, int productId) {
        return new UsbPrinterDeviceId(vendorId, productId);
    }

    private UsbPrinterDeviceId(int vendorId, int productId) {
        this.vendorId = vendorId;
        this.productId = productId;
    }

    public int getVendorId() {
        return vendorId;
    }

    public int getProductId() {
        return productId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UsbPrinterDeviceId)) return false;
        UsbPrinterDeviceId that = (UsbPrinterDeviceId) o;
        return vendorId == that.vendorId && productId == that.productId;
    }

    @Override
    public int hashCode() {
        return 31 * vendorId + productId;
    }
}

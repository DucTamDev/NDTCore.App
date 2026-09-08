package com.ndtcorepos.thermalprinter.transport.usb;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;

import java.util.concurrent.CompletableFuture;

/**
 * Quản lý vòng đời kết nối USB — permission, mở/đóng UsbDeviceConnection, claim interface.
 */
public final class UsbConnection implements PrinterConnection {

    private final UsbManager usbManager;
    private final UsbPermission permission;
    private final UsbEndpointResolver endpointResolver;
    private final int vendorId;
    private final int productId;

    private UsbDevice usbDevice;
    private UsbDeviceConnection deviceConnection;
    private UsbInterface claimedInterface;

    public UsbConnection(ReactApplicationContext context, UsbPermission permission, UsbEndpointResolver endpointResolver, int vendorId, int productId) {
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        this.permission = permission;
        this.endpointResolver = endpointResolver;
        this.vendorId = vendorId;
        this.productId = productId;
    }

    /**
     * Mở kết nối USB — xin permission nếu chưa có, sau đó claim interface.
     *
     * <p>Xin permission là bất đồng bộ (dialog hệ thống) — future resolve
     * ngay sau khi gọi requestPermission(), không đợi user bấm "Cho phép".
     * Việc mở UsbDeviceConnection/claimInterface thật diễn ra ngay nếu đã
     * có quyền; nếu chưa có, lùi lại lần write() đầu tiên qua
     * ensureClaimed() (permission lúc đó thường đã được cấp).</p>
     */
    @Override
    public CompletableFuture<PrinterResult> open() {
        long startedAt = System.currentTimeMillis();
        UsbDevice candidate = findCandidate();
        if (candidate == null) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(
                    PrinterErrorCode.USB_DEVICE_NOT_FOUND, "Can not find USB device vendorId=" + vendorId + " productId=" + productId));
        }
        this.usbDevice = candidate;

        if (!permission.hasPermission(candidate)) {
            permission.requestPermission(candidate);
            return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
        }

        try {
            claim(candidate);
        } catch (PrinterConnectionException e) {
            return CompletableFuture.failedFuture(e);
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    private UsbDevice findCandidate() {
        if (usbManager == null) {
            return null;
        }
        for (UsbDevice candidate : usbManager.getDeviceList().values()) {
            if (candidate.getVendorId() == vendorId && candidate.getProductId() == productId
                    && UsbPrinterDiscovery.isPrintableUsbDevice(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private void claim(UsbDevice device) throws PrinterConnectionException {
        UsbInterface usbInterface = endpointResolver.resolveInterface(device);
        UsbDeviceConnection newConnection = usbManager.openDevice(device);
        if (newConnection == null) {
            throw new PrinterConnectionException(PrinterErrorCode.CONNECTION_FAILED, "Failed to open USB connection");
        }
        if (!newConnection.claimInterface(usbInterface, true)) {
            newConnection.close();
            throw new PrinterConnectionException(PrinterErrorCode.USB_INTERFACE_CLAIM_FAILED, "Failed to claim USB interface");
        }
        this.deviceConnection = newConnection;
        this.claimedInterface = usbInterface;
    }

    /**
     * Đảm bảo đã claim interface thật — gọi lười từ UsbWriter lúc write()
     * đầu tiên, vì lúc open() permission có thể chưa được cấp xong.
     */
    boolean ensureClaimed() {
        if (isOpen()) {
            return true;
        }
        if (usbDevice == null || !permission.hasPermission(usbDevice)) {
            return false;
        }
        try {
            claim(usbDevice);
            return true;
        } catch (PrinterConnectionException e) {
            return false;
        }
    }

    UsbDeviceConnection getDeviceConnection() {
        return deviceConnection;
    }

    UsbInterface getClaimedInterface() {
        return claimedInterface;
    }

    /**
     * Đóng kết nối USB và release interface.
     */
    @Override
    public CompletableFuture<PrinterResult> close() {
        long startedAt = System.currentTimeMillis();
        if (deviceConnection != null) {
            if (claimedInterface != null) {
                try {
                    deviceConnection.releaseInterface(claimedInterface);
                } catch (Exception ignored) {
                }
            }
            try {
                deviceConnection.close();
            } catch (Exception ignored) {
            }
        }
        claimedInterface = null;
        deviceConnection = null;
        usbDevice = null;
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    /**
     * Kết nối USB có đang mở không.
     */
    @Override
    public boolean isOpen() {
        return deviceConnection != null && claimedInterface != null;
    }
}

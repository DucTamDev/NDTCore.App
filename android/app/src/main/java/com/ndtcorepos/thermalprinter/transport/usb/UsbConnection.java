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
import com.ndtcorepos.thermalprinter.transport.IPrinterConnection;

import java.util.concurrent.CompletableFuture;

/**
 * Quản lý vòng đời kết nối USB — permission, mở/đóng UsbDeviceConnection, claim interface.
 */
public final class UsbConnection implements IPrinterConnection {

    private final UsbManager usbManager;
    private final UsbPermission permission;
    private final UsbEndpointResolver endpointResolver;
    private final int vendorId;
    private final int productId;

    private UsbDeviceConnection deviceConnection;
    private UsbInterface claimedInterface;

    public UsbConnection(ReactApplicationContext context, UsbPermission permission, UsbEndpointResolver endpointResolver, int vendorId, int productId) {
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        this.permission = permission;
        this.endpointResolver = endpointResolver;
        this.vendorId = vendorId;
        this.productId = productId;
        // close() vốn đã idempotent và làm đúng việc cần làm khi mất kết nối vật lý
        // (release interface, đóng connection, null hoá field) nên tái dùng luôn làm handler rút thiết bị.
        this.permission.registerDeviceDetachListener(vendorId, productId, this::close);
    }

    /**
     * Mở kết nối USB — xin permission nếu chưa có, sau đó claim interface.
     *
     * <p>Xin permission là bất đồng bộ (dialog hệ thống) — nếu chưa có
     * quyền, future trả về CHỈ resolve sau khi có kết quả dialog thật (xem
     * awaitPermissionThenClaim()), không coi việc dialog đang hiện là đã
     * kết nối thành công.</p>
     */
    @Override
    public CompletableFuture<PrinterResult> open() {
        long startedAt = System.currentTimeMillis();

        UsbDevice candidate = findCandidate();

        if (candidate == null) {
            String message = "Can not find USB device vendorId=" + vendorId + " productId=" + productId;
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.USB_DEVICE_NOT_FOUND, message));
        }

        if (!permission.hasPermission(candidate)) {
            return awaitPermissionThenClaim(candidate, startedAt);
        }

        try {
            claim(candidate);
        } catch (PrinterConnectionException exception) {
            return CompletableFuture.failedFuture(exception);
        }

        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    /**
     * Xin quyền USB rồi đợi đúng kết quả dialog hệ thống trước khi resolve
     * future trả cho caller — future chỉ complete thành công sau khi claim
     * interface thật thành công, và complete lỗi PERMISSION_DENIED nếu user
     * từ chối, thay vì báo kết nối thành công ngay khi dialog còn treo.
     */
    private CompletableFuture<PrinterResult> awaitPermissionThenClaim(UsbDevice candidate, long startedAt) {
        CompletableFuture<PrinterResult> future = new CompletableFuture<>();

        permission.registerPermissionResultListener(vendorId, productId, granted -> {
            permission.unregisterPermissionResultListener(vendorId, productId);

            if (!granted) {
                future.completeExceptionally(new PrinterConnectionException(PrinterErrorCode.PERMISSION_DENIED, "User denied USB permission"));
                return;
            }

            try {
                claim(candidate);
                future.complete(PrinterResult.success(System.currentTimeMillis() - startedAt));
            } catch (PrinterConnectionException exception) {
                future.completeExceptionally(exception);
            }
        });

        permission.requestPermission(candidate);

        return future;
    }

    /**
     * Tìm thiết bị USB khớp vendorId/productId hiện có qua UsbManager của Android.
     */
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

    /**
     * Mở UsbDeviceConnection và claim interface qua UsbManager của Android.
     * Chỉ resolve UsbInterface (cần để claim) — resolve UsbEndpoint (cần để
     * ghi) thuộc trách nhiệm của UsbWriter, không phải Connection.
     */
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

    UsbDeviceConnection getDeviceConnection() {
        return deviceConnection;
    }

    UsbInterface getClaimedInterface() {
        return claimedInterface;
    }

    /**
     * Đóng kết nối USB — đóng UsbDeviceConnection là đủ để OS tự thu hồi
     * interface đã claim qua nó, không cần gọi releaseInterface() riêng.
     */
    @Override
    public CompletableFuture<PrinterResult> close() {
        long startedAt = System.currentTimeMillis();

        // Best-effort cleanup — device có thể đã mất kết nối vật lý nên
        // close() có thể tự ném lỗi, không ảnh hưởng tới việc vẫn phải null
        // hoá field bên dưới để connection coi như đã đóng.
        if (deviceConnection != null) {
            try {
                deviceConnection.close();
            } catch (Exception ignored) {
            }
        }

        claimedInterface = null;
        deviceConnection = null;
        permission.unregisterDeviceDetachListener(vendorId, productId);
        permission.unregisterPermissionResultListener(vendorId, productId);

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

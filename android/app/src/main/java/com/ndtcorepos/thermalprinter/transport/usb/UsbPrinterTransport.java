package com.ndtcorepos.thermalprinter.transport.usb;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

public final class UsbPrinterTransport implements IPrinterTransport {

    private static final String TAG = "UsbPrinterTransport";
    private static final int BULK_TRANSFER_TIMEOUT_MS = 100000;

    private final UsbManager usbManager;
    private final UsbPermission permission;

    private UsbDevice usbDevice;
    private UsbInterface usbInterface;
    private UsbEndpoint endpoint;
    private UsbDeviceConnection connection;

    public UsbPrinterTransport(ReactApplicationContext context, UsbPermission permission) {
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        this.permission = permission;
        this.permission.setOnDeviceDetached(this::disconnect);
    }

    /**
     * Chỉ resolve UsbDevice + xin quyền (nếu chưa có) — KHÔNG mở
     * UsbDeviceConnection/claimInterface ở đây. Việc mở kết nối bulk thật diễn
     * ra lười trong write(), vì permission là bất đồng bộ (dialog hệ thống) —
     * successCallback phía JS trả về ngay sau khi gọi requestPermission(),
     * không đợi user bấm "Cho phép". Giữ nguyên hành vi này từ code cũ
     * (USBPrinterAdapter.selectDevice), không sửa timing.
     */
    @Override
    public void connect(PrinterConnection connection) throws PrinterException {
        int vendorId = connection.getUsbVendorId();
        int productId = connection.getUsbProductId();

        if (usbDevice != null && usbDevice.getVendorId() == vendorId && usbDevice.getProductId() == productId) {
            if (!permission.hasPermission(usbDevice)) {
                disconnect();
                permission.requestPermission(usbDevice);
            }
            return;
        }

        if (usbManager.getDeviceList().isEmpty()) {
            throw new PrinterException(PrinterErrorCode.DEVICE_NOT_FOUND, "Device list is empty, can not choose device");
        }

        for (UsbDevice candidate : usbManager.getDeviceList().values()) {
            if (!UsbPrinterDiscovery.isPrintableUsbDevice(candidate)) {
                continue;
            }
            if (candidate.getVendorId() == vendorId && candidate.getProductId() == productId) {
                disconnect();
                permission.requestPermission(candidate);
                this.usbDevice = candidate;
                return;
            }
        }

        throw new PrinterException(PrinterErrorCode.DEVICE_NOT_FOUND, "Can not find specified device");
    }

    @Override
    public void write(PrinterData data) throws PrinterException {
        boolean isOpen = isConnected() || openBulkConnection();
        if (!isOpen) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "Failed to connect to device");
        }

        UsbDeviceConnection activeConnection = connection;
        UsbEndpoint activeEndpoint = endpoint;
        if (activeConnection == null || activeEndpoint == null) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "USB connection lost");
        }

        byte[] bytes = data.getBytes();
        int result = activeConnection.bulkTransfer(activeEndpoint, bytes, bytes.length, BULK_TRANSFER_TIMEOUT_MS);
        Log.i(TAG, "bulkTransfer result=" + result);
        if (result < 0) {
            throw new PrinterException(PrinterErrorCode.WRITE_FAILED, "USB print failed");
        }
    }

    /**
     * `keepConnection=true` ở PrinterService nghĩa là KHÔNG gọi disconnect()
     * giữa các write() liên tiếp. Đóng/mở lại claimInterface() giữa các chunk
     * (vd cài font TrueType ~145KB) làm thiết bị USB không kịp ổn định, chunk
     * sau bulkTransfer trả -1 — xem comment trong UsbTransport.ts (JS) cho
     * log thực tế đã quan sát. Không tự ý gọi disconnect() ở đây.
     */
    private boolean openBulkConnection() {
        if (usbDevice == null) {
            Log.e(TAG, "USB device is not resolved yet");
            return false;
        }

        UsbInterface targetInterface = UsbPrinterDiscovery.findBulkOutInterface(usbDevice);
        UsbEndpoint targetEndpoint = UsbPrinterDiscovery.findBulkOutEndpoint(targetInterface);
        if (targetInterface == null || targetEndpoint == null) {
            Log.e(TAG, "USB device has no bulk OUT endpoint");
            return false;
        }

        UsbDeviceConnection newConnection = usbManager.openDevice(usbDevice);
        if (newConnection == null) {
            Log.e(TAG, "failed to open USB connection");
            return false;
        }

        if (!newConnection.claimInterface(targetInterface, true)) {
            newConnection.close();
            Log.e(TAG, "failed to claim usb interface");
            return false;
        }

        this.usbInterface = targetInterface;
        this.endpoint = targetEndpoint;
        this.connection = newConnection;
        return true;
    }

    @Override
    public void disconnect() {
        if (connection != null) {
            if (usbInterface != null) {
                try {
                    connection.releaseInterface(usbInterface);
                } catch (Exception ignored) {
                }
            }
            try {
                connection.close();
            } catch (Exception ignored) {
            }
        }
        usbInterface = null;
        endpoint = null;
        connection = null;
        usbDevice = null;
    }

    @Override
    public boolean isConnected() {
        return connection != null && endpoint != null;
    }
}

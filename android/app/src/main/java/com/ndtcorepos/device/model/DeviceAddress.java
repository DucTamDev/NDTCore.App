package com.ndtcorepos.device.model;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.util.Locale;

/** Cách tới một thiết bị: USB theo vendorId/productId/serial, Bluetooth theo MAC, LAN theo host/port. */
public final class DeviceAddress {

    private static final int MAX_USB_ID = 0xFFFF;

    private static final int MIN_PORT = 1;

    private static final int MAX_PORT = 65_535;

    private final DeviceType type;

    private final int vendorId;

    private final int productId;

    /** Serial USB; `null` khi không biết (chưa có quyền hoặc thiết bị không có). */
    private final String serialNumber;

    /** Đường dẫn thiết bị USB lấy từ lần quét, vd `/dev/bus/usb/001/004`; chỉ đúng trong lần cắm hiện tại. */
    private final String devicePath;

    /** MAC Bluetooth, luôn viết hoa. */
    private final String mac;

    private final String host;

    private final int port;

    private DeviceAddress(
            DeviceType type,
            int vendorId,
            int productId,
            String serialNumber,
            String devicePath,
            String mac,
            String host,
            int port) {
        this.type = type;
        this.vendorId = vendorId;
        this.productId = productId;
        this.serialNumber = serialNumber;
        this.devicePath = devicePath;
        this.mac = mac;
        this.host = host;
        this.port = port;
    }

    public static DeviceAddress usb(
            int vendorId,
            int productId,
            String serialNumber,
            String devicePath) throws DeviceException {
        requireInRange(vendorId, 0, MAX_USB_ID, "vendorId");
        requireInRange(productId, 0, MAX_USB_ID, "productId");
        return new DeviceAddress(
                DeviceType.USB,
                vendorId,
                productId,
                emptyToNull(serialNumber),
                emptyToNull(devicePath),
                null,
                null,
                0);
    }

    public static DeviceAddress bluetooth(String mac) throws DeviceException {
        String normalizedMac = requireNotBlank(mac, "mac").toUpperCase(Locale.ROOT);
        return new DeviceAddress(DeviceType.BLUETOOTH, 0, 0, null, null, normalizedMac, null, 0);
    }

    public static DeviceAddress lan(String host, int port) throws DeviceException {
        requireInRange(port, MIN_PORT, MAX_PORT, "port");
        return new DeviceAddress(DeviceType.LAN, 0, 0, null, null, null, requireNotBlank(host, "host"), port);
    }

    /** Khoá gộp các lần kết nối đồng thời cùng địa chỉ, dùng trước khi biết đó là thiết bị vật lý nào. */
    public String lookupKey() {
        if (type == DeviceType.BLUETOOTH) {
            return "bluetooth:" + mac;
        }

        if (type == DeviceType.LAN) {
            return "lan:" + host + ":" + port;
        }

        return usbLookupKey();
    }

    private String usbLookupKey() {
        String base = "usb:" + vendorId + ":" + productId;

        if (serialNumber != null) {
            return base + ":" + serialNumber;
        }

        if (devicePath != null) {
            return base + ":@" + devicePath;
        }

        return base;
    }

    public DeviceType type() {
        return type;
    }

    public int vendorId() {
        return vendorId;
    }

    public int productId() {
        return productId;
    }

    public String serialNumber() {
        return serialNumber;
    }

    public String devicePath() {
        return devicePath;
    }

    public String mac() {
        return mac;
    }

    public String host() {
        return host;
    }

    public int port() {
        return port;
    }

    private static String emptyToNull(String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }

        return value;
    }

    private static String requireNotBlank(String value, String fieldName) throws DeviceException {
        if (value == null || value.trim().isEmpty()) {
            throw new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, "Thiếu " + fieldName);
        }

        return value.trim();
    }

    private static void requireInRange(
            int value,
            int min,
            int max,
            String fieldName) throws DeviceException {
        if (value < min || value > max) {
            throw new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, fieldName + " ngoài khoảng: " + value);
        }
    }
}

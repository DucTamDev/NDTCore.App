package com.ndtcorepos.device.model;

import com.ndtcorepos.device.enums.TransportType;

/** Một thiết bị tìm thấy khi quét, chưa kết nối. */
public final class DeviceInfo {

    /** Định danh trong lần cắm hiện tại, dùng làm key danh sách; đổi khi rút ra cắm lại. */
    private final String deviceId;

    private final String name;

    /** Địa chỉ để TS truyền lại nguyên vẹn khi kết nối. */
    private final DeviceAddress address;

    /** Chỉ USB. */
    private final String manufacturerName;

    /** Chỉ USB. */
    private final String productName;

    /** Chỉ USB: app đã được cấp quyền dùng thiết bị này chưa. */
    private final boolean hasPermission;

    private DeviceInfo(
            String deviceId,
            String name,
            DeviceAddress address,
            String manufacturerName,
            String productName,
            boolean hasPermission) {
        this.deviceId = deviceId;
        this.name = name;
        this.address = address;
        this.manufacturerName = manufacturerName;
        this.productName = productName;
        this.hasPermission = hasPermission;
    }

    public static DeviceInfo usb(
            String deviceId,
            String name,
            DeviceAddress address,
            String manufacturerName,
            String productName,
            boolean hasPermission) {
        return new DeviceInfo(deviceId, name, address, manufacturerName, productName, hasPermission);
    }

    public static DeviceInfo bluetooth(
            String deviceId,
            String name,
            DeviceAddress address) {
        return new DeviceInfo(deviceId, name, address, null, null, false);
    }

    public String deviceId() {
        return deviceId;
    }

    public TransportType type() {
        return address.type();
    }

    public String name() {
        return name;
    }

    public DeviceAddress address() {
        return address;
    }

    public String manufacturerName() {
        return manufacturerName;
    }

    public String productName() {
        return productName;
    }

    public boolean hasPermission() {
        return hasPermission;
    }
}

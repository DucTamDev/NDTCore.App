package com.ndtcorepos.device.model;

/** Kết quả kết nối thành công: mã phiên kết nối và thông tin máy đọc được sau khi mở. */
public final class ConnectedDevice {

    /** Mã phiên kết nối cho write/read/disconnect; hết hạn khi rút ra cắm lại nên TS không lưu. */
    private final String connectionId;

    /** Địa chỉ đầy đủ đọc được sau khi mở; USB có serial nếu máy có. */
    private final DeviceAddress address;

    /** Tên thiết bị (tên Bluetooth, tên sản phẩm USB); `null` nếu không đọc được. */
    private final String name;

    /** Chỉ USB; `null` nếu không có. */
    private final String manufacturerName;

    /** Chỉ USB; `null` nếu không có. */
    private final String productName;

    public ConnectedDevice(
            String connectionId,
            DeviceAddress address,
            String name,
            String manufacturerName,
            String productName) {
        this.connectionId = connectionId;
        this.address = address;
        this.name = name;
        this.manufacturerName = manufacturerName;
        this.productName = productName;
    }

    public String connectionId() {
        return connectionId;
    }

    /** Định danh ổn định của máy vật lý, tính từ địa chỉ đã mở. */
    public String deviceId() {
        return address.deviceId();
    }

    public DeviceAddress address() {
        return address;
    }

    public String name() {
        return name;
    }

    public String manufacturerName() {
        return manufacturerName;
    }

    public String productName() {
        return productName;
    }
}

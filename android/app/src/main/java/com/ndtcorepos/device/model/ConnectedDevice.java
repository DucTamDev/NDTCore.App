package com.ndtcorepos.device.model;

/** Kết quả kết nối thành công. */
public final class ConnectedDevice {

    /** Mã của kết nối, xác định từ thiết bị vật lý; chỉ có nghĩa trong phiên kết nối, TS không lưu. */
    private final String connectionId;

    /** Serial đọc từ thiết bị sau khi mở (USB); `null` nếu thiết bị không có hoặc đường truyền không hỗ trợ. */
    private final String serialNumber;

    public ConnectedDevice(String connectionId, String serialNumber) {
        this.connectionId = connectionId;
        this.serialNumber = serialNumber;
    }

    public String connectionId() {
        return connectionId;
    }

    public String serialNumber() {
        return serialNumber;
    }
}

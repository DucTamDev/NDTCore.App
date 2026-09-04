package com.ndtcorepos.thermalprinter.enums;

/**
 * Loại kết nối phần cứng máy in. `wireValue` là chuỗi React Native gửi qua
 * bridge (tham số `connectionType` / field `type` trong connection map).
 */
public enum ConnectionType {
    USB("usb"),
    BLUETOOTH("bluetooth"),
    LAN("lan");

    private final String wireValue;

    ConnectionType(String wireValue) {
        this.wireValue = wireValue;
    }

    public static ConnectionType fromWireValue(String wireValue) {
        for (ConnectionType type : values()) {
            if (type.wireValue.equals(wireValue)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown connection type: " + wireValue);
    }
}

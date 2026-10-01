package com.ndtcorepos.device.enums;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

/** Loại đường truyền tới thiết bị: USB, Bluetooth, LAN. */
public enum TransportType {
    USB("usb"),
    BLUETOOTH("bluetooth"),
    LAN("lan");

    /** Giá trị trao đổi với JS. */
    private final String wireValue;

    TransportType(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static TransportType fromWireValue(String wireValue) throws DeviceException {
        for (TransportType type : values()) {
            if (type.wireValue.equals(wireValue)) {
                return type;
            }
        }

        throw new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, "Loại đường truyền không hợp lệ: " + wireValue);
    }
}

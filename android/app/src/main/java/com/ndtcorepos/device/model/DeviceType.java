package com.ndtcorepos.device.model;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

/** Loại đường truyền tới thiết bị. */
public enum DeviceType {
    USB("usb"),
    BLUETOOTH("bluetooth"),
    LAN("lan");

    /** Giá trị trao đổi với JS. */
    private final String wireValue;

    DeviceType(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static DeviceType fromWireValue(String wireValue) throws DeviceException {
        for (DeviceType type : values()) {
            if (type.wireValue.equals(wireValue)) {
                return type;
            }
        }

        throw new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, "Loại thiết bị không hợp lệ: " + wireValue);
    }
}

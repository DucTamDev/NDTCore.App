package com.ndtcorepos.device.model;

/** Lý do một kết nối mất ngoài ý muốn. */
public enum DisconnectReason {
    USB_DETACHED("usb_detached"),
    BLUETOOTH_DISCONNECTED("bluetooth_disconnected"),
    IO_ERROR("io_error");

    /** Giá trị gửi cho JS. */
    private final String wireValue;

    DisconnectReason(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }
}

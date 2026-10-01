package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.enums.DisconnectReason;

/** Nhận báo một kết nối đã mất ngoài ý muốn (không gọi khi JS chủ động ngắt). */
public interface IDisconnectListener {

    void onDisconnected(String connectionId, DisconnectReason reason);
}

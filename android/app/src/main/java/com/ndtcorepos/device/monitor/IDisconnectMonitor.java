package com.ndtcorepos.device.monitor;

/** Nghe tín hiệu mất kết nối từ hệ thống; `start`/`stop` gọi nhiều lần không sao. */
public interface IDisconnectMonitor {

    void start();

    void stop();
}

package com.ndtcorepos.device.transport;

import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;

/** Tạo transport cho một địa chỉ. */
public interface ITransportFactory {

    /** Tìm thiết bị (có thể xin quyền USB nên được phép chặn) và trả transport chưa mở. */
    ITransport create(DeviceAddress address) throws DeviceException;
}
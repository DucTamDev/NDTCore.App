package com.ndtcorepos.device.discovery;

import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceInfo;

import java.util.List;

/** Liệt kê thiết bị của một loại đường truyền. */
public interface IDeviceDiscovery {

    List<DeviceInfo> discover() throws DeviceException;
}

package com.ndtcorepos.bridge.device;

import static com.ndtcorepos.bridge.device.BridgeLimits.MAX_OPERATION_TIMEOUT_MS;
import static com.ndtcorepos.bridge.device.BridgeLimits.MAX_READ_BYTES;

import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.ndtcorepos.device.enums.DisconnectReason;
import com.ndtcorepos.device.enums.TransportType;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.ConnectedDevice;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;

import java.util.List;

/** Đổi dữ liệu giữa kiểu React Native và kiểu của tầng thiết bị; tham số sai ném `INVALID_ARGUMENT`. */
final class DeviceMapper {

    private DeviceMapper() {
    }

    static TransportType toTransportType(String wireValue) throws DeviceException {
        return TransportType.fromWireValue(wireValue);
    }

    static DeviceAddress toAddress(ReadableMap map) throws DeviceException {
        TransportType type = toTransportType(requireString(map, "type"));

        if (type == TransportType.USB) {
            return toUsbAddress(map);
        }

        if (type == TransportType.BLUETOOTH) {
            return DeviceAddress.bluetooth(requireString(map, "mac"));
        }

        return DeviceAddress.lan(requireString(map, "host"), requireInt(map, "port"));
    }

    static WritableArray toWritableArray(List<DeviceInfo> devices) {
        WritableArray array = Arguments.createArray();

        for (DeviceInfo device : devices) {
            array.pushMap(toWritableMap(device));
        }

        return array;
    }

    static WritableMap toWritableMap(ConnectedDevice connectedDevice) {
        WritableMap map = Arguments.createMap();
        map.putString("connectionId", connectedDevice.connectionId());
        map.putString("deviceId", connectedDevice.deviceId());
        map.putMap("address", toWritableMap(connectedDevice.address()));
        putNullableString(map, "name", connectedDevice.name());
        putNullableString(map, "manufacturerName", connectedDevice.manufacturerName());
        putNullableString(map, "productName", connectedDevice.productName());
        return map;
    }

    static WritableMap toDisconnectedEvent(String connectionId, DisconnectReason reason) {
        WritableMap map = Arguments.createMap();
        map.putString("connectionId", connectionId);
        map.putString("reason", reason.wireValue());
        return map;
    }

    static WritableMap toUserInfo(DeviceException exception) {
        WritableMap map = Arguments.createMap();
        map.putInt("bytesWritten", exception.bytesWritten());
        return map;
    }

    static byte[] toBytes(String base64Data) throws DeviceException {
        if (base64Data == null) {
            throw invalid("Thiếu dữ liệu ghi");
        }

        try {
            return Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException exception) {
            throw invalid("Dữ liệu base64 không hợp lệ");
        }
    }

    static String toBase64OrNull(byte[] data) {
        if (data.length == 0) {
            return null;
        }

        return Base64.encodeToString(data, Base64.NO_WRAP);
    }

    static long toTimeoutMillis(double timeoutMs) throws DeviceException {
        return (long) requireInRange(timeoutMs, MAX_OPERATION_TIMEOUT_MS, "timeoutMs");
    }

    static int toMaxBytes(double maxBytes) throws DeviceException {
        return (int) requireInRange(maxBytes, MAX_READ_BYTES, "maxBytes");
    }

    private static DeviceAddress toUsbAddress(ReadableMap map) throws DeviceException {
        return DeviceAddress.usb(
                requireInt(map, "vendorId"),
                requireInt(map, "productId"),
                optionalString(map, "serialNumber"),
                optionalString(map, "devicePath"));
    }

    private static WritableMap toWritableMap(DeviceInfo device) {
        WritableMap map = Arguments.createMap();
        map.putString("deviceId", device.deviceId());
        map.putString("type", device.type().wireValue());
        putNullableString(map, "name", device.name());
        map.putMap("address", toWritableMap(device.address()));

        if (device.type() == TransportType.USB) {
            putNullableString(map, "manufacturerName", device.manufacturerName());
            putNullableString(map, "productName", device.productName());
            map.putBoolean("hasPermission", device.hasPermission());
        }

        return map;
    }

    private static WritableMap toWritableMap(DeviceAddress address) {
        WritableMap map = Arguments.createMap();
        map.putString("type", address.type().wireValue());

        if (address.type() == TransportType.USB) {
            map.putInt("vendorId", address.vendorId());
            map.putInt("productId", address.productId());
            putNullableString(map, "serialNumber", address.serialNumber());
            putNullableString(map, "devicePath", address.devicePath());
            return map;
        }

        if (address.type() == TransportType.BLUETOOTH) {
            map.putString("mac", address.mac());
            return map;
        }

        map.putString("host", address.host());
        map.putInt("port", address.port());
        return map;
    }

    private static String requireString(ReadableMap map, String key) throws DeviceException {
        if (!map.hasKey(key) || map.getType(key) != ReadableType.String) {
            throw invalid("Thiếu " + key);
        }

        return map.getString(key);
    }

    private static String optionalString(ReadableMap map, String key) throws DeviceException {
        if (!map.hasKey(key) || map.isNull(key)) {
            return null;
        }

        return requireString(map, key);
    }

    private static int requireInt(ReadableMap map, String key) throws DeviceException {
        if (!map.hasKey(key) || map.getType(key) != ReadableType.Number) {
            throw invalid("Thiếu " + key);
        }

        double value = map.getDouble(key);

        if (value != Math.rint(value)) {
            throw invalid(key + " phải là số nguyên");
        }

        return (int) value;
    }

    private static void putNullableString(
            WritableMap map,
            String key,
            String value) {
        if (value == null) {
            map.putNull(key);
            return;
        }

        map.putString(key, value);
    }

    private static double requireInRange(
            double value,
            double max,
            String fieldName) throws DeviceException {
        // Viết dạng phủ định để NaN (mọi phép so sánh đều false) cũng bị từ chối.
        if (!(value >= 1 && value <= max)) {
            throw invalid(fieldName + " phải từ 1 tới " + (long) max);
        }

        return value;
    }

    private static DeviceException invalid(String message) {
        return new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, message);
    }
}

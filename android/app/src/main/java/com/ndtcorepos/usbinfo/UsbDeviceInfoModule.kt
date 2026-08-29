package com.ndtcorepos.usbinfo

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

/**
 * Đọc TOÀN BỘ USB descriptor mà Android phơi ra — thư viện `@poriyaalar/
 * react-native-thermal-receipt-printer` chỉ map `getDeviceName()` (đường
 * `/dev/bus/usb/...`), bỏ mất manufacturer/product/serial/interface/endpoint.
 * Module này chỉ ĐỌC, không mở kết nối. `serialNumber` cần quyền USB cho thiết
 * bị đó (Android 10+) — trước khi user bấm "Kết nối" thường là `null`; gọi lại
 * sau khi đã cấp quyền sẽ có.
 */
class UsbDeviceInfoModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "UsbDeviceInfo"

  @ReactMethod
  fun listDevices(promise: Promise) {
    try {
      val manager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as? UsbManager
      val result = Arguments.createArray()
      if (manager != null) {
        for (device in manager.deviceList.values) {
          result.pushMap(describe(device))
        }
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("USB_ENUM_FAILED", e.message, e)
    }
  }

  private fun describe(d: UsbDevice): WritableMap {
    val map = Arguments.createMap()
    map.putString("deviceName", d.deviceName)
    map.putInt("deviceId", d.deviceId)
    map.putInt("vendorId", d.vendorId)
    map.putInt("productId", d.productId)
    putStringOrNull(map, "manufacturerName", d.manufacturerName)
    putStringOrNull(map, "productName", d.productName)
    putStringOrNull(map, "version", runCatching { d.version }.getOrNull())
    putStringOrNull(map, "serialNumber", safeSerial(d))
    map.putInt("deviceClass", d.deviceClass)
    map.putInt("deviceSubclass", d.deviceSubclass)
    map.putInt("deviceProtocol", d.deviceProtocol)
    map.putInt("interfaceCount", d.interfaceCount)

    var interfaceClass = -1
    var interfaceSubclass = -1
    var interfaceProtocol = -1
    var hasBulkIn = false
    var hasBulkOut = false
    if (d.interfaceCount > 0) {
      val iface = d.getInterface(0)
      interfaceClass = iface.interfaceClass
      interfaceSubclass = iface.interfaceSubclass
      interfaceProtocol = iface.interfaceProtocol
      for (i in 0 until iface.endpointCount) {
        val ep = iface.getEndpoint(i)
        if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK) {
          if (ep.direction == UsbConstants.USB_DIR_IN) hasBulkIn = true
          if (ep.direction == UsbConstants.USB_DIR_OUT) hasBulkOut = true
        }
      }
    }
    map.putInt("interfaceClass", interfaceClass)
    map.putInt("interfaceSubclass", interfaceSubclass)
    map.putInt("interfaceProtocol", interfaceProtocol)
    map.putBoolean("hasBulkInEndpoint", hasBulkIn)
    map.putBoolean("hasBulkOutEndpoint", hasBulkOut)
    return map
  }

  private fun putStringOrNull(map: WritableMap, key: String, value: String?) {
    if (value == null) map.putNull(key) else map.putString(key, value)
  }

  // Android 10+ ném SecurityException nếu app chưa có quyền cho thiết bị này.
  private fun safeSerial(d: UsbDevice): String? =
    try { d.serialNumber } catch (e: SecurityException) { null }
}

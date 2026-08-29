package com.ndtcorepos.usbinfo

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * Đọc TOÀN BỘ USB descriptor mà Android phơi ra — module in nhiệt vendored
 * (`com.ndtcorepos.thermalprinter`) chỉ map `getDeviceName()` (đường
 * `/dev/bus/usb/...`), bỏ mất manufacturer/product/serial + toàn bộ
 * interface/endpoint. Module này chỉ ĐỌC, không mở kết nối.
 *
 * Trả về descriptor lồng đầy đủ (`interfaces[].endpoints[]`) — KHÔNG giả định
 * interface 0 là printer, KHÔNG flatten. `serialNumber` cần quyền USB cho thiết
 * bị đó (Android 10+) — trước khi user "Kết nối" thường `null`.
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

    var hasBulkIn = false
    var hasBulkOut = false
    val interfaces = Arguments.createArray()
    // Quét MỌI interface — thiết bị composite có thể để printer ở interface != 0.
    for (i in 0 until d.interfaceCount) {
      val iface = d.getInterface(i)
      interfaces.pushMap(describeInterface(iface))
      for (j in 0 until iface.endpointCount) {
        val ep = iface.getEndpoint(j)
        if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK) {
          if (ep.direction == UsbConstants.USB_DIR_IN) hasBulkIn = true
          if (ep.direction == UsbConstants.USB_DIR_OUT) hasBulkOut = true
        }
      }
    }
    map.putArray("interfaces", interfaces)
    // Cờ rút gọn (tính trên MỌI interface) cho code JS chỉ cần biết "USB này
    // đọc được phản hồi không" — identify() qua USB khả thi hay không.
    map.putBoolean("hasBulkInEndpoint", hasBulkIn)
    map.putBoolean("hasBulkOutEndpoint", hasBulkOut)
    return map
  }

  private fun describeInterface(iface: UsbInterface): WritableMap {
    val map = Arguments.createMap()
    map.putInt("id", iface.id)
    map.putInt("alternateSetting", iface.alternateSetting)
    map.putInt("class", iface.interfaceClass)
    map.putInt("subclass", iface.interfaceSubclass)
    map.putInt("protocol", iface.interfaceProtocol)
    putStringOrNull(map, "name", iface.name)
    val endpoints: WritableArray = Arguments.createArray()
    for (j in 0 until iface.endpointCount) {
      endpoints.pushMap(describeEndpoint(iface.getEndpoint(j)))
    }
    map.putArray("endpoints", endpoints)
    return map
  }

  private fun describeEndpoint(ep: UsbEndpoint): WritableMap {
    val map = Arguments.createMap()
    map.putInt("address", ep.address)
    map.putInt("number", ep.endpointNumber)
    map.putString("direction", if (ep.direction == UsbConstants.USB_DIR_IN) "in" else "out")
    map.putString("type", endpointTypeName(ep.type))
    map.putInt("maxPacketSize", ep.maxPacketSize)
    map.putInt("interval", ep.interval)
    return map
  }

  private fun endpointTypeName(type: Int): String = when (type) {
    UsbConstants.USB_ENDPOINT_XFER_CONTROL -> "control"
    UsbConstants.USB_ENDPOINT_XFER_ISOC -> "isochronous"
    UsbConstants.USB_ENDPOINT_XFER_BULK -> "bulk"
    UsbConstants.USB_ENDPOINT_XFER_INT -> "interrupt"
    else -> "unknown"
  }

  private fun putStringOrNull(map: WritableMap, key: String, value: String?) {
    if (value == null) map.putNull(key) else map.putString(key, value)
  }

  // Android 10+ ném SecurityException nếu app chưa có quyền cho thiết bị này.
  private fun safeSerial(d: UsbDevice): String? =
    try { d.serialNumber } catch (e: SecurityException) { null }
}

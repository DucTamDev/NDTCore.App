# Native Printer Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay 3 native module Android rời rạc (`RNUSBPrinterModule`/`RNBLEPrinterModule`/`RNNetPrinterModule`) bằng 1 `ThermalPrinterModule` theo kiến trúc layered (bridge → application service → transport resolver → transport), xoá 3 API chết (`printImageData`/`printQrCode`/`printImageBase64`), giữ nguyên hành vi in thật (USB/Bluetooth/LAN) và toàn bộ namespace JS công khai (`USBPrinter`/`BLEPrinter`/`NetPrinter`).

**Architecture:** `ThermalPrinterModule` (RN bridge, Callback boundary duy nhất) → `PrinterService` (return/throw, không biết RN) → `TransportResolver` → `IPrinterTransport` impl theo `ConnectionType` (USB/Bluetooth/LAN). Discovery (`IPrinterDiscovery`) và permission (`UsbPermission`) là 2 nhánh phụ trợ, được `ThermalPrinterModule`/`UsbPrinterTransport` gọi trực tiếp — không đi qua `PrinterService`.

**Tech Stack:** Java (Android), React Native 0.86 New Architecture, Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-09-03-native-printer-architecture-refactor-design.md`

## Global Constraints

- Package gốc: `com.ndtcorepos.thermalprinter`. `enum` là từ khoá reserved trong Java — package chứa các `enum` type đặt tên `enums` (không phải `enum` như bản nháp tài liệu tham chiếu ban đầu).
- Public JS surface **không đổi**: `USBPrinter`/`BLEPrinter`/`NetPrinter` namespace trong `PrinterNativeModule.ts` giữ nguyên chữ ký (`init`, `getDeviceList`, `connectPrinter`, `closeConn`, `printText`) — chỉ đổi implementation bên trong để gọi `NativeModules.ThermalPrinterModule` thay vì 3 module riêng. Mọi call site khác (`UsbTransport.ts`, `NativeAdapter.ts`, `useConnectionSetup.ts`, `PrinterResolver.ts`) gọi qua namespace nên **không cần sửa**.
- Xoá hẳn (không giữ song song): `printImageData`, `printQrCode`, `printImageBase64` ở mọi tầng Java (module, adapter cũ, interface), `UtilsImage.java`, toàn bộ `adapter/`, 5 file `RN*.java` cũ, dependency `com.google.zxing:core` trong `android/app/build.gradle`.
- Giữ nguyên hành vi (không phải cơ hội sửa luôn):
  - Timing permission USB bất đồng bộ — `connectPrinter` USB trả `successCallback` ngay sau khi gọi `requestPermission()`, không đợi user cấp quyền thật.
  - `keepConnection=true` không đóng kết nối USB giữa các lần `printRawData` liên tiếp (chunk lớn, vd font TrueType ~145KB — xem comment trong `UsbTransport.ts`).
  - Delay trước khi đóng socket Bluetooth sau khi ghi xong (`bytes <= 2000 ? 100ms : bytes/5`).
  - iOS: `BLEPrinter.printText`/`NetPrinter.printText` nhánh `Platform.OS === 'ios'` gọi thẳng `NativeModules.RNBLEPrinter`/`NativeModules.RNNetPrinter` — 2 module này KHÔNG tồn tại trên iOS (chưa implement, xem memory "iOS còn nợ"), nhánh này giữ nguyên y hệt (kể cả không hoạt động), không route qua `ThermalPrinterModule` (module đó Android-only).
- Không thêm Java unit test — không có test Java nào hiện tại, I/O hardware thật giá trị test thấp. Mỗi task Java verify bằng compile (`.\gradlew.bat compileDebugJavaWithJavac`, chạy từ `android/`). Task cuối cùng verify bằng thiết bị thật.
- Không tạo interface cho implementation duy nhất: `UsbPermission` là **class cụ thể**, không có `IUsbPermission` (khác tài liệu tham chiếu — chỉ USB cần permission, 1 implementation, không có test double nào cần).
- Không tạo package `constants/` riêng — các hằng số (`ACTION_USB_PERMISSION`, bulk-transfer timeout...) là `private static final` ngay trong class dùng chúng, vì mỗi hằng số chỉ có đúng 1 nơi dùng.
- **Phát hiện ngoài phạm vi (không sửa trong refactor này)**: `BLEPrinterDevice.toRNWritableMap()` hiện trả field `address`/`deviceName`, nhưng type TS `IBLEPrinter` khai báo `inner_mac_address`/`device_name` — sai lệch có sẵn từ trước (khả năng cao khiến `NativeAdapter.listDevices('bluetooth')` luôn trả `deviceId`/`displayName` là `undefined` trong thực tế). Port giữ nguyên field name hiện tại (`address`/`deviceName`) ở `BluetoothPrinterDevice.toWritableMap()`, KHÔNG đổi thành `inner_mac_address`/`device_name` — đây là bug có sẵn, báo lại cho user sau khi xong plan này, không tự sửa vì ngoài phạm vi đã duyệt.

---

### Task 1: Enum + core value models

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/enums/ConnectionType.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/enums/PrinterOperation.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterConnection.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterData.java`

**Interfaces:**
- Produces: `ConnectionType{USB,BLUETOOTH,LAN}` với `getWireValue(): String` / `static fromWireValue(String): ConnectionType`; `PrinterConnection.usb(int,int)`/`.bluetooth(String)`/`.lan(String,int)` + getters; `PrinterData(byte[])` với `getBytes(): byte[]` / `size(): int`.

- [ ] **Step 1: Tạo `enums/ConnectionType.java`**

```java
package com.ndtcorepos.thermalprinter.enums;

/**
 * Loại kết nối phần cứng máy in. `wireValue` là chuỗi React Native gửi qua
 * bridge (tham số `connectionType` / field `type` trong connection map).
 */
public enum ConnectionType {
    USB("usb"),
    BLUETOOTH("bluetooth"),
    LAN("lan");

    private final String wireValue;

    ConnectionType(String wireValue) {
        this.wireValue = wireValue;
    }

    public String getWireValue() {
        return wireValue;
    }

    public static ConnectionType fromWireValue(String wireValue) {
        for (ConnectionType type : values()) {
            if (type.wireValue.equals(wireValue)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown connection type: " + wireValue);
    }
}
```

- [ ] **Step 2: Tạo `enums/PrinterOperation.java`**

```java
package com.ndtcorepos.thermalprinter.enums;

/** Loại thao tác native — dùng để chuẩn hoá field `operation=` khi log. */
public enum PrinterOperation {
    DISCOVER,
    CONNECT,
    WRITE,
    DISCONNECT
}
```

- [ ] **Step 3: Tạo `model/PrinterConnection.java`**

```java
package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Đích kết nối bất biến — Native chỉ thấy vendorId/productId (USB), mac
 * address (Bluetooth) hoặc host/port (LAN); không biết ESC/POS/TSPL.
 */
public final class PrinterConnection {

    private final ConnectionType type;
    private final Integer usbVendorId;
    private final Integer usbProductId;
    private final String bluetoothAddress;
    private final String lanHost;
    private final Integer lanPort;

    private PrinterConnection(ConnectionType type, Integer usbVendorId, Integer usbProductId,
            String bluetoothAddress, String lanHost, Integer lanPort) {
        this.type = type;
        this.usbVendorId = usbVendorId;
        this.usbProductId = usbProductId;
        this.bluetoothAddress = bluetoothAddress;
        this.lanHost = lanHost;
        this.lanPort = lanPort;
    }

    public static PrinterConnection usb(int vendorId, int productId) {
        return new PrinterConnection(ConnectionType.USB, vendorId, productId, null, null, null);
    }

    public static PrinterConnection bluetooth(String address) {
        return new PrinterConnection(ConnectionType.BLUETOOTH, null, null, address, null, null);
    }

    public static PrinterConnection lan(String host, int port) {
        return new PrinterConnection(ConnectionType.LAN, null, null, null, host, port);
    }

    public ConnectionType getType() {
        return type;
    }

    public int getUsbVendorId() {
        return usbVendorId;
    }

    public int getUsbProductId() {
        return usbProductId;
    }

    public String getBluetoothAddress() {
        return bluetoothAddress;
    }

    public String getLanHost() {
        return lanHost;
    }

    public int getLanPort() {
        return lanPort;
    }
}
```

- [ ] **Step 4: Tạo `model/PrinterData.java`**

```java
package com.ndtcorepos.thermalprinter.model;

/** Raw printer bytes bất biến — Native không biết nội dung là gì. */
public final class PrinterData {

    private final byte[] bytes;

    public PrinterData(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("Printer data must not be empty");
        }
        this.bytes = bytes.clone();
    }

    public byte[] getBytes() {
        return bytes.clone();
    }

    public int size() {
        return bytes.length;
    }
}
```

- [ ] **Step 5: Verify compiles**

Run (từ thư mục `android/`): `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL (4 file mới, không file nào khác bị ảnh hưởng).

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/enums android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterConnection.java android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterData.java
git commit -m "feat: add printer enum + core value model layer"
```

---

### Task 2: Error taxonomy

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorCode.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterException.java`

**Interfaces:**
- Consumes: (none — độc lập)
- Produces: `PrinterErrorCode` enum; `PrinterException(PrinterErrorCode, String)` / `PrinterException(PrinterErrorCode, String, Throwable)` với `getCode(): PrinterErrorCode`.

- [ ] **Step 1: Tạo `error/PrinterErrorCode.java`**

```java
package com.ndtcorepos.thermalprinter.error;

/** Chỉ giữ code thực sự phát sinh khi port lại logic cũ — không thêm code "phòng khi cần sau này". */
public enum PrinterErrorCode {
    UNSUPPORTED_CONNECTION,

    DEVICE_NOT_FOUND,
    DEVICE_NOT_CONNECTED,

    DISCOVERY_FAILED,
    CONNECTION_FAILED,

    WRITE_FAILED
}
```

- [ ] **Step 2: Tạo `error/PrinterException.java`**

```java
package com.ndtcorepos.thermalprinter.error;

/** Exception nội bộ tầng native — không tự log, layer tạo ra nó chịu trách nhiệm log nếu cần. */
public class PrinterException extends Exception {

    private final PrinterErrorCode code;

    public PrinterException(PrinterErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public PrinterException(PrinterErrorCode code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public PrinterErrorCode getCode() {
        return code;
    }
}
```

- [ ] **Step 3: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/error
git commit -m "feat: add printer error taxonomy"
```

---

### Task 3: Discovery contract + device model base

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterDevice.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterDeviceId.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/IPrinterDiscovery.java`

**Interfaces:**
- Consumes: `PrinterException` (Task 2)
- Produces: `PrinterDevice{getPrinterDeviceId(): PrinterDeviceId, toWritableMap(): WritableMap}`; `PrinterDeviceId` (abstract base, subclass theo connection type ở Task 4/5); `IPrinterDiscovery{discover(): List<PrinterDevice> throws PrinterException}`.

- [ ] **Step 1: Tạo `model/PrinterDevice.java`**

```java
package com.ndtcorepos.thermalprinter.model;

import com.facebook.react.bridge.WritableMap;

/**
 * 1 thiết bị máy in do discovery tìm thấy. Mỗi ConnectionType có 1
 * implementation cụ thể sống cùng discovery class tạo ra nó
 * (vd `UsbPrinterDevice` trong `discovery.usb`).
 */
public interface PrinterDevice {
    PrinterDeviceId getPrinterDeviceId();
    WritableMap toWritableMap();
}
```

- [ ] **Step 2: Tạo `model/PrinterDeviceId.java`**

```java
package com.ndtcorepos.thermalprinter.model;

/**
 * Base cho id thiết bị — mỗi ConnectionType có 1 subclass immutable riêng
 * (equals/hashCode theo field định danh của loại kết nối đó).
 */
public abstract class PrinterDeviceId {
}
```

- [ ] **Step 3: Tạo `discovery/IPrinterDiscovery.java`**

```java
package com.ndtcorepos.thermalprinter.discovery;

import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;

import java.util.List;

public interface IPrinterDiscovery {
    List<PrinterDevice> discover() throws PrinterException;
}
```

- [ ] **Step 4: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterDevice.java android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterDeviceId.java android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/IPrinterDiscovery.java
git commit -m "feat: add printer discovery contract and device model base"
```

---

### Task 4: USB discovery + permission

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/usb/UsbPrinterDeviceId.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/usb/UsbPrinterDevice.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/usb/UsbPrinterDiscovery.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/UsbPermission.java`

**Interfaces:**
- Consumes: `IPrinterDiscovery`, `PrinterDevice`, `PrinterDeviceId` (Task 3), `PrinterException`/`PrinterErrorCode` (Task 2)
- Produces: `UsbPrinterDiscovery.isPrintableUsbDevice(UsbDevice): boolean`, `.findBulkOutInterface(UsbDevice): UsbInterface`, `.findBulkOutEndpoint(UsbInterface): UsbEndpoint` (static, dùng lại ở Task 8); `UsbPermission(ReactApplicationContext)` với `register()`, `hasPermission(UsbDevice): boolean`, `requestPermission(UsbDevice)`, `setOnDeviceDetached(Runnable)`.

- [ ] **Step 1: Tạo `discovery/usb/UsbPrinterDeviceId.java`**

```java
package com.ndtcorepos.thermalprinter.discovery.usb;

import com.ndtcorepos.thermalprinter.model.PrinterDeviceId;

public final class UsbPrinterDeviceId extends PrinterDeviceId {

    private final int vendorId;
    private final int productId;

    public static UsbPrinterDeviceId valueOf(int vendorId, int productId) {
        return new UsbPrinterDeviceId(vendorId, productId);
    }

    private UsbPrinterDeviceId(int vendorId, int productId) {
        this.vendorId = vendorId;
        this.productId = productId;
    }

    public int getVendorId() {
        return vendorId;
    }

    public int getProductId() {
        return productId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UsbPrinterDeviceId)) return false;
        UsbPrinterDeviceId that = (UsbPrinterDeviceId) o;
        return vendorId == that.vendorId && productId == that.productId;
    }

    @Override
    public int hashCode() {
        return 31 * vendorId + productId;
    }
}
```

- [ ] **Step 2: Tạo `discovery/usb/UsbPrinterDevice.java`**

Port nguyên vẹn từ `adapter/USBPrinterDevice.java` cũ (chỉ đổi package + interface + tên method `toRNWritableMap` → `toWritableMap`) — giữ đầy đủ descriptor (interfaces/endpoints/hasBulkInEndpoint...) dù JS hiện không đọc hết, vì nằm ngoài phạm vi đã duyệt cắt gọn thêm.

```java
package com.ndtcorepos.thermalprinter.discovery.usb;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;
import com.ndtcorepos.thermalprinter.model.PrinterDeviceId;

public final class UsbPrinterDevice implements PrinterDevice {

    private final UsbDevice device;
    private final UsbPrinterDeviceId deviceId;

    public UsbPrinterDevice(UsbDevice device) {
        if (device == null) {
            throw new IllegalArgumentException("USB device must not be null");
        }
        this.device = device;
        this.deviceId = UsbPrinterDeviceId.valueOf(device.getVendorId(), device.getProductId());
    }

    @Override
    public PrinterDeviceId getPrinterDeviceId() {
        return deviceId;
    }

    /** Native-only access. Do not expose UsbDevice directly to React Native. */
    public UsbDevice getUsbDevice() {
        return device;
    }

    @Override
    public WritableMap toWritableMap() {
        WritableMap map = Arguments.createMap();
        putDeviceInfo(map);
        putDescriptorInfo(map);
        putInterfaces(map);
        return map;
    }

    private void putDeviceInfo(WritableMap map) {
        map.putString("deviceName", device.getDeviceName());
        map.putInt("deviceId", device.getDeviceId());
        map.putInt("vendorId", device.getVendorId());
        map.putInt("productId", device.getProductId());

        putStringOrNull(map, "manufacturerName", device.getManufacturerName());
        putStringOrNull(map, "productName", device.getProductName());
        putStringOrNull(map, "version", getVersionSafely());
        putStringOrNull(map, "serialNumber", getSerialNumberSafely());
    }

    private void putDescriptorInfo(WritableMap map) {
        map.putInt("deviceClass", device.getDeviceClass());
        map.putInt("deviceSubclass", device.getDeviceSubclass());
        map.putInt("deviceProtocol", device.getDeviceProtocol());
    }

    private void putInterfaces(WritableMap map) {
        WritableArray interfaces = Arguments.createArray();
        boolean hasBulkIn = false;
        boolean hasBulkOut = false;

        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface usbInterface = device.getInterface(i);
            interfaces.pushMap(toInterfaceMap(usbInterface));

            if (hasBulkEndpoint(usbInterface, UsbConstants.USB_DIR_IN)) {
                hasBulkIn = true;
            }
            if (hasBulkEndpoint(usbInterface, UsbConstants.USB_DIR_OUT)) {
                hasBulkOut = true;
            }
        }

        map.putArray("interfaces", interfaces);
        map.putBoolean("hasBulkInEndpoint", hasBulkIn);
        map.putBoolean("hasBulkOutEndpoint", hasBulkOut);
    }

    private WritableMap toInterfaceMap(UsbInterface usbInterface) {
        WritableMap map = Arguments.createMap();
        map.putInt("id", usbInterface.getId());
        map.putInt("alternateSetting", usbInterface.getAlternateSetting());
        map.putInt("class", usbInterface.getInterfaceClass());
        map.putInt("subclass", usbInterface.getInterfaceSubclass());
        map.putInt("protocol", usbInterface.getInterfaceProtocol());
        putStringOrNull(map, "name", usbInterface.getName());

        WritableArray endpoints = Arguments.createArray();
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            endpoints.pushMap(toEndpointMap(usbInterface.getEndpoint(i)));
        }
        map.putInt("endpointCount", usbInterface.getEndpointCount());
        map.putArray("endpoints", endpoints);
        return map;
    }

    private WritableMap toEndpointMap(UsbEndpoint endpoint) {
        WritableMap map = Arguments.createMap();
        map.putInt("address", endpoint.getAddress());
        map.putInt("number", endpoint.getEndpointNumber());
        map.putString("direction", getDirectionName(endpoint.getDirection()));
        map.putString("type", getEndpointTypeName(endpoint.getType()));
        map.putInt("maxPacketSize", endpoint.getMaxPacketSize());
        map.putInt("interval", endpoint.getInterval());
        return map;
    }

    private boolean hasBulkEndpoint(UsbInterface usbInterface, int direction) {
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(i);
            if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.getDirection() == direction) {
                return true;
            }
        }
        return false;
    }

    private String getDirectionName(int direction) {
        if (direction == UsbConstants.USB_DIR_IN) return "in";
        if (direction == UsbConstants.USB_DIR_OUT) return "out";
        return "unknown";
    }

    private String getEndpointTypeName(int type) {
        switch (type) {
            case UsbConstants.USB_ENDPOINT_XFER_CONTROL: return "control";
            case UsbConstants.USB_ENDPOINT_XFER_ISOC: return "isochronous";
            case UsbConstants.USB_ENDPOINT_XFER_BULK: return "bulk";
            case UsbConstants.USB_ENDPOINT_XFER_INT: return "interrupt";
            default: return "unknown";
        }
    }

    private String getVersionSafely() {
        try {
            return device.getVersion();
        } catch (SecurityException ignored) {
            return null;
        }
    }

    private String getSerialNumberSafely() {
        try {
            return device.getSerialNumber();
        } catch (SecurityException ignored) {
            return null;
        }
    }

    private void putStringOrNull(WritableMap map, String key, String value) {
        if (value == null) {
            map.putNull(key);
        } else {
            map.putString(key, value);
        }
    }
}
```

- [ ] **Step 3: Tạo `discovery/usb/UsbPrinterDiscovery.java`**

```java
package com.ndtcorepos.thermalprinter.discovery.usb;

import android.content.Context;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;

import java.util.ArrayList;
import java.util.List;

public final class UsbPrinterDiscovery implements IPrinterDiscovery {

    private final UsbManager usbManager;

    public UsbPrinterDiscovery(ReactApplicationContext context) {
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    @Override
    public List<PrinterDevice> discover() throws PrinterException {
        if (usbManager == null) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "USBManager is not available");
        }

        List<PrinterDevice> devices = new ArrayList<>();
        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (isPrintableUsbDevice(device)) {
                devices.add(new UsbPrinterDevice(device));
            }
        }
        return devices;
    }

    /** Dùng lại ở UsbPrinterTransport để resolve UsbDevice theo vendorId/productId. */
    public static boolean isPrintableUsbDevice(UsbDevice device) {
        if (device == null || device.getVendorId() < 0 || device.getProductId() < 0) {
            return false;
        }
        return findBulkOutInterface(device) != null;
    }

    public static UsbInterface findBulkOutInterface(UsbDevice device) {
        if (device == null) return null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface usbInterface = device.getInterface(i);
            if (findBulkOutEndpoint(usbInterface) != null) {
                return usbInterface;
            }
        }
        return null;
    }

    public static UsbEndpoint findBulkOutEndpoint(UsbInterface usbInterface) {
        if (usbInterface == null) return null;
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(i);
            if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK
                    && endpoint.getDirection() == UsbConstants.USB_DIR_OUT) {
                return endpoint;
            }
        }
        return null;
    }
}
```

- [ ] **Step 4: Tạo `permission/UsbPermission.java`**

```java
package com.ndtcorepos.thermalprinter.permission;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;
import android.widget.Toast;

import com.facebook.react.bridge.ReactApplicationContext;

/**
 * USB runtime permission (Android yêu cầu cấp quyền theo từng UsbDevice) +
 * phát hiện thiết bị bị rút qua BroadcastReceiver. Không biết gì về bulk
 * transfer — UsbPrinterTransport gọi vào đây để hỏi/xin quyền và nhận
 * callback khi thiết bị mất kết nối vật lý.
 */
public final class UsbPermission {

    private static final String TAG = "UsbPermission";
    private static final String ACTION_USB_PERMISSION = "com.ndtcorepos.thermalprinter.USB_PERMISSION";

    private final ReactApplicationContext context;
    private final UsbManager usbManager;
    private PendingIntent permissionIntent;
    private Runnable onDeviceDetached;

    public UsbPermission(ReactApplicationContext context) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    public void setOnDeviceDetached(Runnable listener) {
        this.onDeviceDetached = listener;
    }

    public void register() {
        Intent intent = new Intent(ACTION_USB_PERMISSION);
        intent.setPackage(context.getPackageName());

        int flag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_MUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
        this.permissionIntent = PendingIntent.getBroadcast(context, 0, intent, flag);

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }
        Log.v(TAG, "USB permission receiver registered");
    }

    public boolean hasPermission(UsbDevice device) {
        return usbManager.hasPermission(device);
    }

    public void requestPermission(UsbDevice device) {
        usbManager.requestPermission(device, permissionIntent);
    }

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            String action = intent.getAction();
            if (ACTION_USB_PERMISSION.equals(action)) {
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                Log.v(TAG, "permission result granted=" + granted);
                if (!granted) {
                    Toast.makeText(ctx, "User refuses to obtain USB device permissions", Toast.LENGTH_LONG).show();
                }
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                Toast.makeText(ctx, "USB device has been turned off", Toast.LENGTH_LONG).show();
                if (onDeviceDetached != null) {
                    onDeviceDetached.run();
                }
            }
        }
    };
}
```

- [ ] **Step 5: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/usb android/app/src/main/java/com/ndtcorepos/thermalprinter/permission
git commit -m "feat: add USB discovery and permission layer"
```

---

### Task 5: Bluetooth discovery

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDeviceId.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDevice.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDiscovery.java`

**Interfaces:**
- Consumes: `IPrinterDiscovery`, `PrinterDevice`, `PrinterDeviceId` (Task 3), `PrinterException`/`PrinterErrorCode` (Task 2)
- Produces: `BluetoothPrinterDeviceId.valueOf(String): BluetoothPrinterDeviceId` (dùng ở Task 7)

- [ ] **Step 1: Tạo `discovery/bluetooth/BluetoothPrinterDeviceId.java`**

```java
package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import com.ndtcorepos.thermalprinter.model.PrinterDeviceId;

public final class BluetoothPrinterDeviceId extends PrinterDeviceId {

    private final String address;

    public static BluetoothPrinterDeviceId valueOf(String address) {
        return new BluetoothPrinterDeviceId(address);
    }

    private BluetoothPrinterDeviceId(String address) {
        this.address = address;
    }

    public String getAddress() {
        return address;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BluetoothPrinterDeviceId)) return false;
        return address.equals(((BluetoothPrinterDeviceId) o).address);
    }

    @Override
    public int hashCode() {
        return address.hashCode();
    }
}
```

- [ ] **Step 2: Tạo `discovery/bluetooth/BluetoothPrinterDevice.java`**

Field name giữ nguyên `address`/`deviceName` như code cũ (`adapter/BLEPrinterDevice.java`) — xem ghi chú "Phát hiện ngoài phạm vi" ở Global Constraints, không đổi thành `inner_mac_address`/`device_name`.

```java
package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import android.bluetooth.BluetoothDevice;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;
import com.ndtcorepos.thermalprinter.model.PrinterDeviceId;

public final class BluetoothPrinterDevice implements PrinterDevice {

    private final BluetoothDevice device;
    private final BluetoothPrinterDeviceId deviceId;

    public BluetoothPrinterDevice(BluetoothDevice device) {
        this.device = device;
        this.deviceId = BluetoothPrinterDeviceId.valueOf(device.getAddress());
    }

    @Override
    public PrinterDeviceId getPrinterDeviceId() {
        return deviceId;
    }

    @Override
    public WritableMap toWritableMap() {
        WritableMap map = Arguments.createMap();
        map.putString("address", device.getAddress());
        map.putString("deviceName", getDeviceNameSafely());
        return map;
    }

    private String getDeviceNameSafely() {
        try {
            return device.getName();
        } catch (SecurityException e) {
            return null;
        }
    }
}
```

- [ ] **Step 3: Tạo `discovery/bluetooth/BluetoothPrinterDiscovery.java`**

```java
package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public final class BluetoothPrinterDiscovery implements IPrinterDiscovery {

    @Override
    public List<PrinterDevice> discover() throws PrinterException {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "No bluetooth adapter available");
        }
        if (!adapter.isEnabled()) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "Bluetooth is not enabled");
        }

        List<PrinterDevice> devices = new ArrayList<>();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        for (BluetoothDevice device : bonded) {
            devices.add(new BluetoothPrinterDevice(device));
        }
        return devices;
    }
}
```

- [ ] **Step 4: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth
git commit -m "feat: add Bluetooth discovery layer"
```

---

### Task 6: Transport contract + Network transport

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/IPrinterTransport.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/network/NetworkPrinterTransport.java`

**Interfaces:**
- Consumes: `PrinterConnection`, `PrinterData` (Task 1), `PrinterException`/`PrinterErrorCode` (Task 2)
- Produces: `IPrinterTransport{connect(PrinterConnection) throws PrinterException, write(PrinterData) throws PrinterException, disconnect(), isConnected(): boolean}` — contract dùng lại nguyên vẹn ở Task 7/8/9.

- [ ] **Step 1: Tạo `transport/IPrinterTransport.java`**

```java
package com.ndtcorepos.thermalprinter.transport;

import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;

public interface IPrinterTransport {
    void connect(PrinterConnection connection) throws PrinterException;
    void write(PrinterData data) throws PrinterException;
    void disconnect();
    boolean isConnected();
}
```

- [ ] **Step 2: Tạo `transport/network/NetworkPrinterTransport.java`**

`connect()` idempotent (no-op nếu đã kết nối đúng host/port) vì `PrinterService` không gọi lại `connect()` trước mỗi `write()` (xem Task 9) — riêng LAN, `connectPrinter` JS luôn đi qua bước này trước khi in nên vẫn cần idempotent để tránh mở lại socket dư thừa nếu user bấm "kết nối" nhiều lần.

```java
package com.ndtcorepos.thermalprinter.transport.network;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;

public final class NetworkPrinterTransport implements IPrinterTransport {

    private Socket socket;

    @Override
    public void connect(PrinterConnection connection) throws PrinterException {
        String host = connection.getLanHost();
        int port = connection.getLanPort();

        if (isConnected() && socket.getInetAddress().getHostAddress().equals(host) && socket.getPort() == port) {
            return;
        }

        try {
            Socket newSocket = new Socket(host, port);
            if (!newSocket.isConnected()) {
                throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED,
                        "Unable to build connection with host: " + host + ", port: " + port);
            }
            disconnect();
            this.socket = newSocket;
        } catch (IOException e) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "Failed to connect printer: " + e.getMessage(), e);
        }
    }

    @Override
    public void write(PrinterData data) throws PrinterException {
        if (!isConnected()) {
            throw new PrinterException(PrinterErrorCode.DEVICE_NOT_CONNECTED,
                    "LAN connection is not built, may be you forgot to connectPrinter");
        }
        try {
            OutputStream out = socket.getOutputStream();
            out.write(data.getBytes());
            out.flush();
        } catch (IOException e) {
            throw new PrinterException(PrinterErrorCode.WRITE_FAILED, "Failed to write data: " + e.getMessage(), e);
        }
    }

    @Override
    public void disconnect() {
        if (socket != null && !socket.isClosed()) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
        socket = null;
    }

    @Override
    public boolean isConnected() {
        return socket != null && !socket.isClosed();
    }
}
```

- [ ] **Step 3: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/IPrinterTransport.java android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/network
git commit -m "feat: add printer transport contract and LAN transport"
```

---

### Task 7: Bluetooth transport

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothPrinterTransport.java`

**Interfaces:**
- Consumes: `IPrinterTransport` (Task 6), `PrinterConnection`/`PrinterData` (Task 1), `PrinterException`/`PrinterErrorCode` (Task 2)
- Produces: `BluetoothPrinterTransport` implements `IPrinterTransport` — dùng ở Task 10.

- [ ] **Step 1: Tạo `transport/bluetooth/BluetoothPrinterTransport.java`**

Giữ delay trước khi đóng socket (`bytes <= 2000 ? 100ms : bytes/5`) từ code cũ — chỉ áp dụng khi `disconnect()` được gọi ngay sau 1 `write()` thành công (không sleep nếu `closeConn()` gọi trực tiếp không có write nào trước đó).

```java
package com.ndtcorepos.thermalprinter.transport.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

public final class BluetoothPrinterTransport implements IPrinterTransport {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

    private BluetoothDevice device;
    private BluetoothSocket socket;
    private int pendingDrainBytes = -1;

    @Override
    public void connect(PrinterConnection connection) throws PrinterException {
        String address = connection.getBluetoothAddress();

        if (device != null && device.getAddress().equals(address) && isConnected()) {
            return;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "No bluetooth adapter available");
        }
        if (!adapter.isEnabled()) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "Bluetooth is not enabled");
        }

        BluetoothDevice target = findBondedDevice(adapter, address);
        if (target == null) {
            throw new PrinterException(PrinterErrorCode.DEVICE_NOT_FOUND,
                    "Can not find the specified printing device, please pair it in system Bluetooth settings first.");
        }

        disconnect();
        try {
            BluetoothSocket newSocket = openSocket(target);
            newSocket.connect();
            this.device = target;
            this.socket = newSocket;
        } catch (IOException e) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "Failed to connect bluetooth printer: " + e.getMessage(), e);
        }
    }

    private BluetoothDevice findBondedDevice(BluetoothAdapter adapter, String address) {
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        for (BluetoothDevice candidate : bonded) {
            if (candidate.getAddress().equals(address)) {
                return candidate;
            }
        }
        return null;
    }

    private BluetoothSocket openSocket(BluetoothDevice target) throws IOException {
        try {
            return target.createRfcommSocketToServiceRecord(SPP_UUID);
        } catch (IOException e) {
            return target.createRfcommSocketToServiceRecord(SPP_UUID);
        }
    }

    @Override
    public void write(PrinterData data) throws PrinterException {
        if (!isConnected()) {
            throw new PrinterException(PrinterErrorCode.DEVICE_NOT_CONNECTED,
                    "Bluetooth connection is not built, may be you forgot to connectPrinter");
        }
        try {
            byte[] bytes = data.getBytes();
            OutputStream out = socket.getOutputStream();
            out.write(bytes);
            out.flush();
            pendingDrainBytes = bytes.length;
        } catch (IOException e) {
            throw new PrinterException(PrinterErrorCode.WRITE_FAILED, "Failed to write data: " + e.getMessage(), e);
        }
    }

    @Override
    public void disconnect() {
        if (socket != null) {
            if (pendingDrainBytes >= 0) {
                sleepForDrain(pendingDrainBytes);
                pendingDrainBytes = -1;
            }
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }
        device = null;
    }

    private void sleepForDrain(int bytes) {
        try {
            Thread.sleep(bytes <= 2000 ? 100 : bytes / 5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public boolean isConnected() {
        return socket != null && socket.isConnected();
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth
git commit -m "feat: add Bluetooth transport"
```

---

### Task 8: USB transport

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbPrinterTransport.java`

**Interfaces:**
- Consumes: `IPrinterTransport` (Task 6), `PrinterConnection`/`PrinterData` (Task 1), `PrinterException`/`PrinterErrorCode` (Task 2), `UsbPrinterDiscovery.isPrintableUsbDevice/findBulkOutInterface/findBulkOutEndpoint` (Task 4), `UsbPermission` (Task 4)
- Produces: `UsbPrinterTransport(ReactApplicationContext, UsbPermission)` implements `IPrinterTransport` — dùng ở Task 10.

- [ ] **Step 1: Tạo `transport/usb/UsbPrinterTransport.java`**

```java
package com.ndtcorepos.thermalprinter.transport.usb;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

public final class UsbPrinterTransport implements IPrinterTransport {

    private static final String TAG = "UsbPrinterTransport";
    private static final int BULK_TRANSFER_TIMEOUT_MS = 100000;

    private final UsbManager usbManager;
    private final UsbPermission permission;

    private UsbDevice usbDevice;
    private UsbInterface usbInterface;
    private UsbEndpoint endpoint;
    private UsbDeviceConnection connection;

    public UsbPrinterTransport(ReactApplicationContext context, UsbPermission permission) {
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        this.permission = permission;
        this.permission.setOnDeviceDetached(this::disconnect);
    }

    /**
     * Chỉ resolve UsbDevice + xin quyền (nếu chưa có) — KHÔNG mở
     * UsbDeviceConnection/claimInterface ở đây. Việc mở kết nối bulk thật diễn
     * ra lười trong write(), vì permission là bất đồng bộ (dialog hệ thống) —
     * successCallback phía JS trả về ngay sau khi gọi requestPermission(),
     * không đợi user bấm "Cho phép". Giữ nguyên hành vi này từ code cũ
     * (USBPrinterAdapter.selectDevice), không sửa timing.
     */
    @Override
    public void connect(PrinterConnection connection) throws PrinterException {
        int vendorId = connection.getUsbVendorId();
        int productId = connection.getUsbProductId();

        if (usbDevice != null && usbDevice.getVendorId() == vendorId && usbDevice.getProductId() == productId) {
            if (!permission.hasPermission(usbDevice)) {
                disconnect();
                permission.requestPermission(usbDevice);
            }
            return;
        }

        if (usbManager.getDeviceList().isEmpty()) {
            throw new PrinterException(PrinterErrorCode.DEVICE_NOT_FOUND, "Device list is empty, can not choose device");
        }

        for (UsbDevice candidate : usbManager.getDeviceList().values()) {
            if (!UsbPrinterDiscovery.isPrintableUsbDevice(candidate)) {
                continue;
            }
            if (candidate.getVendorId() == vendorId && candidate.getProductId() == productId) {
                disconnect();
                permission.requestPermission(candidate);
                this.usbDevice = candidate;
                return;
            }
        }

        throw new PrinterException(PrinterErrorCode.DEVICE_NOT_FOUND, "Can not find specified device");
    }

    @Override
    public void write(PrinterData data) throws PrinterException {
        boolean isOpen = isConnected() || openBulkConnection();
        if (!isOpen) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "Failed to connect to device");
        }

        byte[] bytes = data.getBytes();
        int result = connection.bulkTransfer(endpoint, bytes, bytes.length, BULK_TRANSFER_TIMEOUT_MS);
        Log.i(TAG, "bulkTransfer result=" + result);
        if (result < 0) {
            throw new PrinterException(PrinterErrorCode.WRITE_FAILED, "USB print failed");
        }
    }

    /**
     * `keepConnection=true` ở PrinterService nghĩa là KHÔNG gọi disconnect()
     * giữa các write() liên tiếp. Đóng/mở lại claimInterface() giữa các chunk
     * (vd cài font TrueType ~145KB) làm thiết bị USB không kịp ổn định, chunk
     * sau bulkTransfer trả -1 — xem comment trong UsbTransport.ts (JS) cho
     * log thực tế đã quan sát. Không tự ý gọi disconnect() ở đây.
     */
    private boolean openBulkConnection() {
        if (usbDevice == null) {
            Log.e(TAG, "USB device is not resolved yet");
            return false;
        }

        UsbInterface targetInterface = UsbPrinterDiscovery.findBulkOutInterface(usbDevice);
        UsbEndpoint targetEndpoint = UsbPrinterDiscovery.findBulkOutEndpoint(targetInterface);
        if (targetInterface == null || targetEndpoint == null) {
            Log.e(TAG, "USB device has no bulk OUT endpoint");
            return false;
        }

        UsbDeviceConnection newConnection = usbManager.openDevice(usbDevice);
        if (newConnection == null) {
            Log.e(TAG, "failed to open USB connection");
            return false;
        }

        if (!newConnection.claimInterface(targetInterface, true)) {
            newConnection.close();
            Log.e(TAG, "failed to claim usb interface");
            return false;
        }

        this.usbInterface = targetInterface;
        this.endpoint = targetEndpoint;
        this.connection = newConnection;
        return true;
    }

    @Override
    public void disconnect() {
        if (connection != null) {
            if (usbInterface != null) {
                try {
                    connection.releaseInterface(usbInterface);
                } catch (Exception ignored) {
                }
            }
            try {
                connection.close();
            } catch (Exception ignored) {
            }
        }
        usbInterface = null;
        endpoint = null;
        connection = null;
        usbDevice = null;
    }

    @Override
    public boolean isConnected() {
        return connection != null && endpoint != null;
    }
}
```

> **Post-review fix (2026-09-04):** the code above was corrected after Task 8's review found `disconnect()` originally left `usbDevice` set. Since `disconnect()` also runs as the `onDeviceDetached` callback (physical unplug), a stale `usbDevice` would make `connect()`'s early-return branch reuse the pre-unplug `UsbDevice` object on replug of the same vendor/product printer — `usbManager.openDevice(usbDevice)` on that stale object is likely to fail. Old code avoided this via a `deviceTurnedOff` flag forcing a fresh `getDeviceList()` scan; nulling `usbDevice` here achieves the same effect more directly (the early-return branch's `usbDevice != null` check now fails after any disconnect, forcing `connect()` to re-scan). See ledger "Task 8 review (2026-09-04)".

- [ ] **Step 2: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb
git commit -m "feat: add USB transport"
```

---

### Task 9: Application layer — TransportResolver + PrinterService

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/application/TransportResolver.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/application/WriteResult.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/application/PrinterService.java`

**Interfaces:**
- Consumes: `IPrinterTransport` (Task 6/7/8), `IPrinterDiscovery` (Task 3/4/5), `ConnectionType` (Task 1), `PrinterConnection`/`PrinterData` (Task 1), `PrinterDevice` (Task 3), `PrinterException`/`PrinterErrorCode` (Task 2)
- Produces: `TransportResolver(Map<ConnectionType,IPrinterTransport>).resolve(ConnectionType): IPrinterTransport`; `PrinterService(TransportResolver, Map<ConnectionType,IPrinterDiscovery>)` với `discover(ConnectionType): List<PrinterDevice>`, `connect(PrinterConnection)`, `write(ConnectionType, PrinterData, boolean): WriteResult`, `disconnect(ConnectionType)` — tất cả `throws PrinterException`, không có `Callback` nào trong signature. Dùng ở Task 10.

- [ ] **Step 1: Tạo `application/TransportResolver.java`**

```java
package com.ndtcorepos.thermalprinter.application;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

import java.util.Map;

public final class TransportResolver {

    private final Map<ConnectionType, IPrinterTransport> transports;

    public TransportResolver(Map<ConnectionType, IPrinterTransport> transports) {
        this.transports = transports;
    }

    public IPrinterTransport resolve(ConnectionType type) throws PrinterException {
        IPrinterTransport transport = transports.get(type);
        if (transport == null) {
            throw new PrinterException(PrinterErrorCode.UNSUPPORTED_CONNECTION, "Unsupported connection type: " + type);
        }
        return transport;
    }
}
```

- [ ] **Step 2: Tạo `application/WriteResult.java`**

```java
package com.ndtcorepos.thermalprinter.application;

public final class WriteResult {

    private final int bytesWritten;
    private final long durationMs;

    public WriteResult(int bytesWritten, long durationMs) {
        this.bytesWritten = bytesWritten;
        this.durationMs = durationMs;
    }

    public int getBytesWritten() {
        return bytesWritten;
    }

    public long getDurationMs() {
        return durationMs;
    }
}
```

- [ ] **Step 3: Tạo `application/PrinterService.java`**

`write()` KHÔNG gọi lại `transport.connect()` — connect và write là 2 bước JS gọi riêng biệt (`connectPrinter` rồi mới `printRawData` nhiều lần), transport tự nhớ target đã connect (USB còn tự mở lười trong `write()` nếu chưa mở, xem Task 8). Đo `durationMs` bằng `SystemClock.elapsedRealtime()`, log không chứa raw bytes/base64.

```java
package com.ndtcorepos.thermalprinter.application;

import android.os.SystemClock;
import android.util.Log;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

import java.util.List;
import java.util.Map;

public final class PrinterService {

    private static final String TAG = "PrinterService";

    private final TransportResolver transportResolver;
    private final Map<ConnectionType, IPrinterDiscovery> discoveries;

    public PrinterService(TransportResolver transportResolver, Map<ConnectionType, IPrinterDiscovery> discoveries) {
        this.transportResolver = transportResolver;
        this.discoveries = discoveries;
    }

    public List<PrinterDevice> discover(ConnectionType type) throws PrinterException {
        IPrinterDiscovery discovery = discoveries.get(type);
        if (discovery == null) {
            throw new PrinterException(PrinterErrorCode.UNSUPPORTED_CONNECTION, "Discovery not supported for: " + type);
        }
        return discovery.discover();
    }

    public void connect(PrinterConnection connection) throws PrinterException {
        transportResolver.resolve(connection.getType()).connect(connection);
    }

    public WriteResult write(ConnectionType type, PrinterData data, boolean keepConnection) throws PrinterException {
        long startedAt = SystemClock.elapsedRealtime();
        IPrinterTransport transport = transportResolver.resolve(type);

        transport.write(data);
        if (!keepConnection) {
            transport.disconnect();
        }

        long durationMs = SystemClock.elapsedRealtime() - startedAt;
        Log.i(TAG, "operation=write connection=" + type + " bytes=" + data.size() + " durationMs=" + durationMs + " result=success");
        return new WriteResult(data.size(), durationMs);
    }

    public void disconnect(ConnectionType type) throws PrinterException {
        transportResolver.resolve(type).disconnect();
    }
}
```

- [ ] **Step 4: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/application
git commit -m "feat: add printer application layer (TransportResolver, PrinterService)"
```

---

### Task 10: RN bridge — ThermalPrinterModule + package + wiring

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterPackage.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/MainApplication.kt`

**Interfaces:**
- Consumes: `PrinterService`/`TransportResolver`/`WriteResult` (Task 9), `IPrinterDiscovery` impls (Task 4/5), `IPrinterTransport` impls (Task 6/7/8), `UsbPermission` (Task 4), `ConnectionType`/`PrinterConnection`/`PrinterData` (Task 1)
- Produces: RN module tên `"ThermalPrinterModule"` — public contract cho JS (Task 12): `init(String connectionType, Callback, Callback)`, `getDeviceList(String connectionType, Callback, Callback)`, `connectPrinter(ReadableMap connection, Callback, Callback)`, `closeConn(String connectionType)`, `printRawData(String connectionType, String base64Data, Boolean keepConnection, Callback, Callback)`.

- [ ] **Step 1: Tạo `module/ThermalPrinterModule.java`**

```java
package com.ndtcorepos.thermalprinter.module;

import android.bluetooth.BluetoothAdapter;
import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;

import com.ndtcorepos.thermalprinter.application.PrinterService;
import com.ndtcorepos.thermalprinter.application.TransportResolver;
import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.bluetooth.BluetoothPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.bluetooth.BluetoothPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.network.NetworkPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.usb.UsbPrinterTransport;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * RN bridge duy nhất cho printer — Callback boundary. Từ PrinterService trở
 * xuống không còn biết React Native tồn tại (return/throw PrinterException).
 */
public class ThermalPrinterModule extends ReactContextBaseJavaModule {

    private final PrinterService printerService;
    private final UsbPermission usbPermission;
    private boolean usbPermissionRegistered = false;

    public ThermalPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);

        this.usbPermission = new UsbPermission(reactContext);

        Map<ConnectionType, IPrinterTransport> transports = new EnumMap<>(ConnectionType.class);
        transports.put(ConnectionType.USB, new UsbPrinterTransport(reactContext, usbPermission));
        transports.put(ConnectionType.BLUETOOTH, new BluetoothPrinterTransport());
        transports.put(ConnectionType.LAN, new NetworkPrinterTransport());

        Map<ConnectionType, IPrinterDiscovery> discoveries = new EnumMap<>(ConnectionType.class);
        discoveries.put(ConnectionType.USB, new UsbPrinterDiscovery(reactContext));
        discoveries.put(ConnectionType.BLUETOOTH, new BluetoothPrinterDiscovery());

        this.printerService = new PrinterService(new TransportResolver(transports), discoveries);
    }

    @Override
    public String getName() {
        return "ThermalPrinterModule";
    }

    @ReactMethod
    public void init(String connectionType, Callback successCallback, Callback errorCallback) {
        try {
            ConnectionType type = ConnectionType.fromWireValue(connectionType);
            if (type == ConnectionType.USB) {
                if (!usbPermissionRegistered) {
                    usbPermission.register();
                    usbPermissionRegistered = true;
                }
            } else if (type == ConnectionType.BLUETOOTH) {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    errorCallback.invoke("No bluetooth adapter available");
                    return;
                }
                if (!adapter.isEnabled()) {
                    errorCallback.invoke("bluetooth adapter is not enabled");
                    return;
                }
            }
            successCallback.invoke();
        } catch (Exception e) {
            errorCallback.invoke(e.getMessage());
        }
    }

    @ReactMethod
    public void getDeviceList(String connectionType, Callback successCallback, Callback errorCallback) {
        try {
            ConnectionType type = ConnectionType.fromWireValue(connectionType);
            List<PrinterDevice> devices = printerService.discover(type);
            if (devices.isEmpty()) {
                errorCallback.invoke("No Device Found");
                return;
            }
            WritableArray result = Arguments.createArray();
            for (PrinterDevice device : devices) {
                result.pushMap(device.toWritableMap());
            }
            successCallback.invoke(result);
        } catch (PrinterException e) {
            errorCallback.invoke(e.getMessage());
        }
    }

    @ReactMethod
    public void connectPrinter(ReadableMap connection, Callback successCallback, Callback errorCallback) {
        try {
            printerService.connect(toPrinterConnection(connection));
            successCallback.invoke(Arguments.createMap());
        } catch (PrinterException e) {
            errorCallback.invoke(e.getMessage());
        }
    }

    @ReactMethod
    public void closeConn(String connectionType) {
        try {
            printerService.disconnect(ConnectionType.fromWireValue(connectionType));
        } catch (PrinterException ignored) {
        }
    }

    @ReactMethod
    public void printRawData(String connectionType, String base64Data, Boolean keepConnection,
            Callback successCallback, Callback errorCallback) {
        new Thread(() -> {
            try {
                ConnectionType type = ConnectionType.fromWireValue(connectionType);
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                printerService.write(type, new PrinterData(bytes), keepConnection);
                successCallback.invoke("Print SuccessFully");
            } catch (PrinterException e) {
                errorCallback.invoke(e.getMessage());
            } catch (IllegalArgumentException e) {
                errorCallback.invoke("Invalid base64 data: " + e.getMessage());
            }
        }).start();
    }

    private PrinterConnection toPrinterConnection(ReadableMap connection) {
        ConnectionType type = ConnectionType.fromWireValue(connection.getString("type"));
        switch (type) {
            case USB:
                return PrinterConnection.usb(connection.getInt("vendorId"), connection.getInt("productId"));
            case BLUETOOTH:
                return PrinterConnection.bluetooth(connection.getString("innerAddress"));
            case LAN:
                return PrinterConnection.lan(connection.getString("host"), connection.getInt("port"));
            default:
                throw new IllegalArgumentException("Unsupported connection type: " + type);
        }
    }
}
```

- [ ] **Step 2: Tạo `module/ThermalPrinterPackage.java`**

```java
package com.ndtcorepos.thermalprinter.module;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class ThermalPrinterPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        return Arrays.asList(new NativeModule[] { new ThermalPrinterModule(reactContext) });
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
```

- [ ] **Step 3: Sửa `MainApplication.kt`**

Đổi import (dòng 9) và đăng ký package (dòng 20):

```kotlin
import com.ndtcorepos.thermalprinter.module.ThermalPrinterPackage
```

```kotlin
          add(ThermalPrinterPackage())
```

- [ ] **Step 4: Verify compiles**

Run: `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL (`RNPrinterPackage` cũ vẫn còn file nhưng không còn được đăng ký — chưa xoá, sẽ xoá ở Task 11).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/module android/app/src/main/java/com/ndtcorepos/MainApplication.kt
git commit -m "feat: add ThermalPrinterModule RN bridge and wire into MainApplication"
```

---

### Task 11: Xoá code cũ + dọn dependency + full compile

**Files:**
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/RNBLEPrinterModule.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/RNNetPrinterModule.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/RNUSBPrinterModule.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/RNPrinterModule.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/RNPrinterPackage.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/adapter/` (toàn bộ thư mục — 11 file: `BLEPrinterAdapter.java`, `BLEPrinterDevice.java`, `BLEPrinterDeviceId.java`, `NetPrinterAdapter.java`, `NetPrinterDevice.java`, `NetPrinterDeviceId.java`, `PrinterAdapter.java`, `PrinterDevice.java`, `PrinterDeviceId.java`, `USBPrinterAdapter.java`, `USBPrinterDevice.java`, `USBPrinterDeviceId.java`, `UtilsImage.java`)
- Modify: `android/app/build.gradle` (xoá dòng `implementation("com.google.zxing:core:3.3.0")`)

**Interfaces:** (không có — task dọn dẹp, không tạo API mới)

- [ ] **Step 1: Xoá 5 file `RN*.java` cũ**

```bash
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/RNBLEPrinterModule.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/RNNetPrinterModule.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/RNUSBPrinterModule.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/RNPrinterModule.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/RNPrinterPackage.java
```

- [ ] **Step 2: Xoá toàn bộ thư mục `adapter/` cũ**

```bash
git rm -r android/app/src/main/java/com/ndtcorepos/thermalprinter/adapter
```

- [ ] **Step 3: Xoá dependency zxing không còn dùng**

Sửa `android/app/build.gradle`, xoá dòng:
```gradle
    implementation("com.google.zxing:core:3.3.0")
```

- [ ] **Step 4: Full compile verification**

Run (từ thư mục `android/`): `.\gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL — không còn reference nào tới `RNUSBPrinter`/`RNBLEPrinter`/`RNNetPrinter`/`adapter.*`/`com.google.zxing` trong toàn bộ `android/app/src/main/java/com/ndtcorepos/thermalprinter/`.

Run: `.\gradlew.bat assembleDebug`
Expected: BUILD SUCCESSFUL (build APK debug đầy đủ, không chỉ compile Java).

- [ ] **Step 5: Commit**

```bash
git add android/app/build.gradle
git commit -m "chore: remove legacy RN printer modules and adapter layer"
```

---

### Task 12: JS bridge — viết lại `PrinterNativeModule.ts`

**Files:**
- Modify: `src/features/printer/adapters/native/PrinterNativeModule.ts`

**Interfaces:**
- Consumes: `NativeModules.ThermalPrinterModule` (Task 10) với contract: `init(connectionType, successCb, errorCb)`, `getDeviceList(connectionType, successCb, errorCb)`, `connectPrinter(connectionMap, successCb, errorCb)`, `closeConn(connectionType)`, `printRawData(connectionType, base64Data, keepConnection, successCb, errorCb)`.
- Produces: **Không đổi** — `USBPrinter`, `BLEPrinter`, `NetPrinter`, `ThermalPrinterAdapter`, `ensureNativeInitialized`, `ensureUsbInitialized`, `printRawDataUsb`, `printRawDataBluetooth`, `printRawDataLan` giữ nguyên chữ ký cho mọi call site khác (`UsbTransport.ts`, `NativeAdapter.ts`, `useConnectionSetup.ts`, `PrinterResolver.ts` — các file này KHÔNG cần sửa).

- [ ] **Step 1: Viết lại toàn bộ nội dung file**

```typescript
import { NativeModules, Platform } from 'react-native';
import type { ConnectionType } from '../../models/printer/PrinterDevice';
import * as EPToolkit from './utils/EPToolkit';

/**
 * Lớp JS của native module `ThermalPrinterModule`
 * (`com.ndtcorepos.thermalprinter.module`, code ở
 * `android/app/src/main/java/com/ndtcorepos/thermalprinter/`) — chỉ Android.
 * 1 native module duy nhất cho cả 3 loại kết nối (khác bản cũ: 3 module rời
 * `RNUSBPrinter`/`RNBLEPrinter`/`RNNetPrinter`) — mọi lệnh nhận thêm tham số
 * `connectionType` ("usb"/"bluetooth"/"lan") để native route đúng transport.
 * 3 namespace JS (`USBPrinter`/`BLEPrinter`/`NetPrinter`) giữ nguyên để không
 * phải sửa call site khác trong `src/features/printer`.
 *
 * Gốc: copy từ `@poriyaalar/react-native-thermal-receipt-printer` `dist/index.js`,
 * chuyển sang TS. Pipeline `printText` → `EPToolkit.exchange_text` → base64 →
 * native `printRawData`.
 *
 * Lược bỏ so với bản gốc: `NetPrinterEventEmitter` + enum sự kiện scan (app
 * không dùng), `exchange_image` (Jimp không chạy trong RN), `printImageData`/
 * `printQrCode`/`printImageBase64` (dead code, không call site nào dùng —
 * xem docs/superpowers/specs/2026-09-03-native-printer-architecture-refactor-design.md).
 */
const ThermalPrinterModule = NativeModules.ThermalPrinterModule;

/** Tuỳ chọn in văn bản. / Text printing options. */
export interface PrinterOptions {
  beep?: boolean;
  cut?: boolean;
  tailingLine?: boolean;
  encoding?: string;
  keepConnection?: boolean;
}

/** 1 endpoint của USB interface. / One endpoint of a USB interface. */
export interface UsbEndpointInfo {
  address: number;
  number: number;
  direction: 'in' | 'out';
  type: 'control' | 'isochronous' | 'bulk' | 'interrupt' | 'unknown';
  maxPacketSize: number;
  interval: number;
}

/** 1 interface của USB device. / One interface of a USB device. */
export interface UsbInterfaceInfo {
  id: number;
  alternateSetting: number;
  /** USB class code — 7 = Printer. */
  class: number;
  subclass: number;
  /** 2 = bidirectional (IEEE-1284) → đọc được device ID / phản hồi. */
  protocol: number;
  name: string | null;
  endpoints: UsbEndpointInfo[];
}

/**
 * Thiết bị máy in USB — `getDeviceList()` trả TOÀN BỘ descriptor (xem
 * `UsbPrinterDevice.toWritableMap()` tầng native). `vendor_id`/`product_id`
 * là `number` (native `putInt`); các field enrichment optional vì `serialNumber`
 * cần quyền USB (Android 10+) và native cũ hơn có thể chưa build vào.
 *
 * USB printer device — `getDeviceList()` returns the full descriptor.
 */
export interface IUSBPrinter {
  device_name: string;
  device_id?: number;
  vendor_id: number;
  product_id: number;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  version?: string | null;
  deviceClass?: number;
  deviceSubclass?: number;
  deviceProtocol?: number;
  interfaces?: UsbInterfaceInfo[];
  /** Có bulk-IN endpoint ở BẤT KỲ interface nào → đọc được phản hồi máy in. */
  hasBulkInEndpoint?: boolean;
  hasBulkOutEndpoint?: boolean;
}

/** Thiết bị máy in Bluetooth. / Bluetooth printer device. */
export interface IBLEPrinter {
  device_name: string;
  inner_mac_address: string;
}

/** Thiết bị máy in LAN. / LAN printer device. */
export interface INetPrinter {
  device_name: string;
  host: string;
  port: number;
}

type SuccessCallback = (message?: string) => void;
type ErrorCallback = (error: Error) => void;

const defaultTextOptions: PrinterOptions = { beep: false, cut: false, tailingLine: false, encoding: 'UTF8' };
const defaultBillOptions: PrinterOptions = { beep: true, cut: true, tailingLine: true, encoding: 'UTF8' };

const textTo64Buffer = (text: string, opts: PrinterOptions): string => {
  const options = { ...defaultTextOptions, ...opts };
  return EPToolkit.exchange_text(text, options).toString('base64').replace('G0AcJhxD/xsy', '');
};

const billTo64Buffer = (text: string, opts: PrinterOptions): string => {
  const options = { ...defaultBillOptions, ...opts };
  return EPToolkit.exchange_text(text, options).toString('base64').replace('G0AcJhxD/xsy', '');
};

/** Bỏ tag định dạng khi gửi thẳng text sang PrinterSDK (iOS). / Strip tags for iOS PrinterSDK. */
const textPreprocessingIOS = (text: string): { text: string; opts: { beep: boolean; cut: boolean } } => ({
  text: text
    .replace(/<\/?CB>/g, '')
    .replace(/<\/?CM>/g, '')
    .replace(/<\/?CD>/g, '')
    .replace(/<\/?C>/g, '')
    .replace(/<\/?D>/g, '')
    .replace(/<\/?B>/g, '')
    .replace(/<\/?M>/g, ''),
  opts: { beep: true, cut: true },
});

/** Namespace kết nối + in qua USB. / USB connect + print namespace. */
export const USBPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => ThermalPrinterModule.init('usb', () => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<IUSBPrinter[]> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.getDeviceList('usb', (printers: IUSBPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (vendorId: number, productId: number): Promise<IUSBPrinter> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.connectPrinter(
        { type: 'usb', vendorId, productId },
        (printer: IUSBPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      ThermalPrinterModule.closeConn('usb');
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void =>
    ThermalPrinterModule.printRawData(
      'usb',
      textTo64Buffer(text, opts),
      opts?.keepConnection,
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    ),

  printBill: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void =>
    ThermalPrinterModule.printRawData(
      'usb',
      billTo64Buffer(text, opts),
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    ),
};

/** Namespace kết nối + in qua Bluetooth. / Bluetooth connect + print namespace. */
export const BLEPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => ThermalPrinterModule.init('bluetooth', () => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<IBLEPrinter[]> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.getDeviceList('bluetooth', (printers: IBLEPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (inner_mac_address: string): Promise<IBLEPrinter> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.connectPrinter(
        { type: 'bluetooth', innerAddress: inner_mac_address },
        (printer: IBLEPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      ThermalPrinterModule.closeConn('bluetooth');
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void => {
    if (Platform.OS === 'ios') {
      // Native iOS chưa implement (xem Global Constraints trong plan) — giữ
      // nguyên hành vi cũ, không route qua ThermalPrinterModule (Android-only).
      const processed = textPreprocessingIOS(text);
      NativeModules.RNBLEPrinter.printRawData(
        processed.text,
        processed.opts,
        (msg: string) => cbSuccess?.(msg),
        (error: Error) => cbErr?.(error),
      );
      return;
    }
    ThermalPrinterModule.printRawData(
      'bluetooth',
      textTo64Buffer(text, opts),
      opts?.keepConnection,
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    );
  },
};

/** Namespace kết nối + in qua LAN. / LAN connect + print namespace. */
export const NetPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => ThermalPrinterModule.init('lan', () => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<INetPrinter[]> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.getDeviceList('lan', (printers: INetPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (host: string, port: number): Promise<INetPrinter> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.connectPrinter(
        { type: 'lan', host, port },
        (printer: INetPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      ThermalPrinterModule.closeConn('lan');
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void => {
    if (Platform.OS === 'ios') {
      // Native iOS chưa implement — giữ nguyên hành vi cũ (xem BLEPrinter.printText).
      const processed = textPreprocessingIOS(text);
      NativeModules.RNNetPrinter.printRawData(
        processed.text,
        processed.opts,
        (msg: string) => cbSuccess?.(msg),
        (error: Error) => cbErr?.(error),
      );
      return;
    }
    ThermalPrinterModule.printRawData(
      'lan',
      textTo64Buffer(text, opts),
      opts?.keepConnection,
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// USB lifecycle helpers (app-specific, không có trong upstream) — `ThermalPrinterModule`
// là native module singleton dùng chung `EscPosDriver` + `TsplDriver` (qua
// `UsbTransport`).
// ─────────────────────────────────────────────────────────────────────────────

const initPromises: Partial<Record<ConnectionType, Promise<void>>> = {};

/**
 * `ThermalPrinterModule` là native singleton dùng chung cho mọi connectionType
 * — gọi `init()` 2 lần từ 2 driver/adapter độc lập cho CÙNG 1 connectionType
 * sẽ đăng ký trùng side-effect (vd USB đăng ký lại BroadcastReceiver). Memoize
 * theo connectionType để toàn app chỉ `init()` đúng 1 lần / loại kết nối.
 */
export const ensureNativeInitialized = (connectionType: ConnectionType): Promise<void> => {
  const existing = initPromises[connectionType];
  if (existing) return existing;
  const ns = connectionType === 'usb' ? USBPrinter : connectionType === 'bluetooth' ? BLEPrinter : NetPrinter;
  const promise = ns.init();
  initPromises[connectionType] = promise;
  return promise;
};

/** @deprecated dùng `ensureNativeInitialized('usb')`. */
export const ensureUsbInitialized = (): Promise<void> => ensureNativeInitialized('usb');

/**
 * Ghi byte thô (base64) qua USB — native decode base64 rồi `bulkTransfer()`
 * gửi nguyên byte, KHÔNG qua encode ESC/POS như `printText`. Dùng cho TSPL
 * (giao thức byte thô).
 */
export const printRawDataUsb = (base64Data: string, keepConnection: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    ThermalPrinterModule.printRawData(
      'usb',
      base64Data,
      keepConnection,
      () => resolve(),
      (error: Error) => reject(error),
    );
  });

/** Ghi byte thô (base64) qua Bluetooth — không encode. */
export const printRawDataBluetooth = (base64Data: string, keepConnection: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    ThermalPrinterModule.printRawData('bluetooth', base64Data, keepConnection, () => resolve(), (error: Error) => reject(error));
  });

/** Ghi byte thô (base64) qua LAN — không encode. */
export const printRawDataLan = (base64Data: string, keepConnection: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    ThermalPrinterModule.printRawData('lan', base64Data, keepConnection, () => resolve(), (error: Error) => reject(error));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Boundary cho `EscPosDriver`: chọn namespace theo connectionType + chuẩn hoá
// `printText()` (callback) thành Promise (spec §2.3 — ngoại lệ pragmatic: gộp
// connect+encode+write theo connectionType thay vì đi qua `Transport` chung).
// ─────────────────────────────────────────────────────────────────────────────

/** Tuỳ chọn `printText` cho `EscPosDriver`. / `printText` options for `EscPosDriver`. */
export interface ThermalPrinterPrintTextOptions {
  keepConnection: boolean;
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}

interface ThermalPrinterNamespaceMap {
  usb: typeof USBPrinter;
  bluetooth: typeof BLEPrinter;
  lan: typeof NetPrinter;
}

const namespaces: ThermalPrinterNamespaceMap = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };

export const ThermalPrinterAdapter = {
  /**
   * Generic theo `T extends ConnectionType` (thay vì trả union) để caller
   * gọi `namespaceFor('lan').connectPrinter(ip, port)` được TypeScript suy
   * luận đúng overload của từng namespace — 3 namespace có `connectPrinter`
   * khác chữ ký hẳn nhau (LAN: `(host, port)`, BLE: `(mac)`, USB:
   * `(vendorId, productId)`), trả union sẽ làm TS giao (intersect) tham số
   * của cả 3 chữ ký lại thành `never`.
   */
  namespaceFor: <T extends ConnectionType>(connectionType: T): ThermalPrinterNamespaceMap[T] => namespaces[connectionType],

  printTextAsync(connectionType: ConnectionType, text: string, options: ThermalPrinterPrintTextOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      ThermalPrinterAdapter.namespaceFor(connectionType).printText(
        text,
        options,
        () => resolve(),
        (error: Error) => reject(error),
      );
    });
  },
};
```

- [ ] **Step 2: Run type-check**

Run: `npm run type-check`
Expected: không lỗi mới liên quan tới `PrinterNativeModule.ts` (lỗi ở file khác, nếu có, không thuộc phạm vi task này).

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/adapters/native/PrinterNativeModule.ts
git commit -m "refactor: route PrinterNativeModule through unified ThermalPrinterModule"
```

---

### Task 13: Cập nhật test JS

**Files:**
- Modify: `src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts`
- Modify: `jest.setup.js`

**Interfaces:**
- Consumes: `NativeModules.ThermalPrinterModule` mock shape từ Task 12's contract.

- [ ] **Step 1: Sửa `jest.setup.js`**

Đổi khối global mock stub cuối file (dòng ~110-119) — chỉ phần stub `NativeModules.RNUSBPrinter` cho `requireActual`, đổi sang `NativeModules.ThermalPrinterModule`. Khối `jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', ...)` phía trên (dòng ~80-108) mock ở mức MODULE (trả namespace `USBPrinter`/`BLEPrinter`/`NetPrinter` giả) — không đổi shape, chỉ xoá key `printImageBase64` không còn tồn tại sau refactor.

```javascript
jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', () => {
  const namespace = () => ({
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockImplementation((_text, _opts, cbSuccess) => cbSuccess?.('ok')),
    printBill: jest.fn().mockImplementation((_text, _opts, cbSuccess) => cbSuccess?.('ok')),
  });
  const USBPrinter = namespace();
  const BLEPrinter = namespace();
  const NetPrinter = namespace();
  const namespaces = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };
  return {
    USBPrinter,
    BLEPrinter,
    NetPrinter,
    ThermalPrinterAdapter: {
      namespaceFor: (connectionType) => namespaces[connectionType],
      printTextAsync: jest.fn().mockResolvedValue(undefined),
    },
    ensureUsbInitialized: jest.fn().mockResolvedValue(undefined),
    ensureNativeInitialized: jest.fn().mockResolvedValue(undefined),
    printRawDataUsb: jest.fn().mockResolvedValue(undefined),
    printRawDataBluetooth: jest.fn().mockResolvedValue(undefined),
    printRawDataLan: jest.fn().mockResolvedValue(undefined),
  };
});

// PrinterNativeModule.test.ts dùng requireActual để test bản THẬT (ensureUsbInitialized,
// namespace) — cần NativeModules.ThermalPrinterModule tồn tại vì RN jest preset không có.
{
  const { NativeModules } = require('react-native');
  NativeModules.ThermalPrinterModule = {
    ...NativeModules.ThermalPrinterModule,
    init: jest.fn((_connectionType, cbSuccess) => cbSuccess?.()),
    printRawData: jest.fn((_connectionType, _d, _k, cbSuccess) => cbSuccess?.('ok')),
  };
}
```

- [ ] **Step 2: Viết lại `PrinterNativeModule.test.ts`**

Jest preset RN mặc định `Platform.OS = 'ios'`, nên `NetPrinter.printText`/`BLEPrinter.printText` (test dùng `ThermalPrinterAdapter.printTextAsync(ConnectionType.lan, ...)`) sẽ đi nhánh iOS gọi `NativeModules.RNNetPrinter` — giữ stub cho 2 native cũ này, không xoá, vì nhánh iOS trong `PrinterNativeModule.ts` (Task 12) vẫn tham chiếu chúng.

```typescript
import { NativeModules } from 'react-native';
import { ConnectionType } from '../../../models/printer/PrinterDevice';

// `ThermalPrinterAdapter` sống trong cùng file với 3 namespace, nên không mock
// riêng namespace được — stub `NativeModules.ThermalPrinterModule` rồi lấy bản
// THẬT qua requireActual (bỏ qua mock toàn cục ở jest.setup.js).
const mkNativeModule = () => ({
  init: jest.fn((_connectionType: string, cbOk: () => void) => cbOk()),
  getDeviceList: jest.fn((_connectionType: string, cbOk: (d: unknown[]) => void) => cbOk([])),
  connectPrinter: jest.fn(),
  closeConn: jest.fn(),
  printRawData: jest.fn(
    (_connectionType: string, _data: unknown, _keep: unknown, cbOk?: (m: string) => void) => cbOk?.('ok'),
  ),
});

// Nhánh iOS trong BLEPrinter/NetPrinter.printText gọi thẳng
// NativeModules.RNBLEPrinter/RNNetPrinter (native iOS chưa implement — xem
// Global Constraints trong plan). Jest preset RN mặc định Platform.OS='ios'
// nên nhánh này chạy trong test dù app thật chạy Android — giữ stub tối
// thiểu để không throw, KHÔNG đụng tới vì ngoài phạm vi refactor (Android-only).
const mkLegacyIosStub = () => ({ printRawData: jest.fn() });

const originals = {
  ThermalPrinterModule: NativeModules.ThermalPrinterModule,
  RNBLEPrinter: NativeModules.RNBLEPrinter,
  RNNetPrinter: NativeModules.RNNetPrinter,
};

beforeEach(() => {
  NativeModules.ThermalPrinterModule = mkNativeModule();
  NativeModules.RNBLEPrinter = mkLegacyIosStub();
  NativeModules.RNNetPrinter = mkLegacyIosStub();
});
afterEach(() => {
  Object.assign(NativeModules, originals);
  jest.resetModules();
});

const loadReal = () =>
  jest.requireActual('../PrinterNativeModule') as typeof import('../PrinterNativeModule');

describe('ThermalPrinterAdapter', () => {
  it('namespaceFor returns the namespace matching each connectionType', () => {
    const { ThermalPrinterAdapter, USBPrinter, BLEPrinter, NetPrinter } = loadReal();
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.usb)).toBe(USBPrinter);
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.bluetooth)).toBe(BLEPrinter);
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.lan)).toBe(NetPrinter);
  });

  it('printTextAsync resolves when the native module invokes the success callback', async () => {
    const { ThermalPrinterAdapter } = loadReal();
    await expect(
      ThermalPrinterAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).resolves.toBeUndefined();
  });

  it('printTextAsync rejects when the native module invokes the error callback', async () => {
    NativeModules.RNNetPrinter.printRawData = jest.fn(
      (_text: unknown, _opts: unknown, _cbOk?: () => void, cbErr?: (e: Error) => void) => cbErr?.(new Error('boom')),
    );
    const { ThermalPrinterAdapter } = loadReal();
    await expect(
      ThermalPrinterAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).rejects.toThrow('boom');
  });
});

describe('ensureUsbInitialized', () => {
  it('gọi ThermalPrinterModule.init("usb", ...) đúng 1 lần dù được gọi nhiều lần (memoize)', async () => {
    const { ensureUsbInitialized } = loadReal();
    await ensureUsbInitialized();
    await ensureUsbInitialized();
    expect(NativeModules.ThermalPrinterModule.init).toHaveBeenCalledTimes(1);
    expect(NativeModules.ThermalPrinterModule.init).toHaveBeenCalledWith('usb', expect.any(Function), expect.any(Function));
  });
});

describe('printRawDataUsb', () => {
  it('resolve khi native gọi success callback', async () => {
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).resolves.toBeUndefined();
    expect(NativeModules.ThermalPrinterModule.printRawData).toHaveBeenCalledWith(
      'usb',
      'QUI=',
      true,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('reject khi native gọi error callback', async () => {
    NativeModules.ThermalPrinterModule.printRawData = jest.fn(
      (_connectionType: string, _data: unknown, _keep: unknown, _cbOk?: () => void, cbErr?: (e: Error) => void) =>
        cbErr?.(new Error('USB fail')),
    );
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).rejects.toThrow('USB fail');
  });
});
```

- [ ] **Step 3: Run test suite đầy đủ**

Run: `npm test`
Expected: PASS toàn bộ (bao gồm `PrinterNativeModule.test.ts`, `NativeAdapter.test.ts`, `UsbTransport.test.ts` — 2 file sau dùng global mock ở jest.setup.js, không cần sửa, nhưng phải PASS để xác nhận không bị ảnh hưởng).

- [ ] **Step 4: Run type-check + lint**

Run: `npm run type-check`
Expected: 0 error.

Run: `npm run lint`
Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add jest.setup.js src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts
git commit -m "test: update printer native module tests for ThermalPrinterModule"
```

---

### Task 14: Manual device verification

**Files:** (không có — checklist thủ công trên thiết bị thật, theo skill `run`)

- [ ] **Step 1: Build + cài app debug lên thiết bị Android thật**

Run: `npm run android` (hoặc `.\gradlew.bat assembleDebug` rồi `adb install`)
Expected: app cài đặt và mở được, không crash khi vào màn "Thêm máy in".

- [ ] **Step 2: USB — kết nối + in thử**

Trong app: Cài đặt → Máy in → Thêm máy in USB → chọn thiết bị → kết nối → in thử (bill ESC/POS ngắn).
Expected: kết nối thành công, bill in ra đúng nội dung.

- [ ] **Step 3: USB — regression `keepConnection` (chunk lớn)**

Nếu app có màn cài font TrueType cho TSPL (xem `docs/superpowers/specs/2026-08-27-tspl-truetype-font-design.md`), thực hiện cài font qua USB.
Expected: cài đặt thành công hết ~145KB, không lỗi giữa chừng (regression check cho `keepConnection` — đây là behavior dễ vỡ nhất trong refactor này).

- [ ] **Step 4: Bluetooth — kết nối + in thử**

Pair máy in Bluetooth trong Cài đặt hệ thống Android trước. Trong app: Thêm máy in Bluetooth → chọn thiết bị đã pair → kết nối → in thử.
Expected: kết nối thành công, bill in ra đúng nội dung.

- [ ] **Step 5: LAN — kết nối + in thử**

Trong app: Thêm máy in LAN → nhập IP/port máy in → kết nối → in thử.
Expected: kết nối thành công, bill in ra đúng nội dung.

- [ ] **Step 6: Xác nhận không còn warning/log thừa**

Run: `adb logcat | grep -i "ThermalPrinter\|PrinterService\|UsbPrinterTransport"` (trong lúc thực hiện Step 2-5)
Expected: log theo format `operation=... connection=... bytes=... durationMs=... result=success` (§40 spec), KHÔNG có raw bytes/base64/nội dung bill trong log.

---

## Ghi chú sau khi hoàn thành plan

Sau khi xong Task 14, báo lại user bug có sẵn phát hiện trong lúc port (xem Global Constraints — `BLEPrinterDevice` field name `address`/`deviceName` không khớp type TS `inner_mac_address`/`device_name`) để user quyết định có sửa ở 1 task/PR riêng hay không — refactor này chủ động KHÔNG tự sửa.

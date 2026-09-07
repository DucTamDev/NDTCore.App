# Native Printer Registry + Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế toàn bộ tầng native Android printer (`ThermalPrinterModule`/`PrinterService`, 1 device active/`ConnectionType`) bằng model `PrinterRegistry` (nhiều printer cùng loại kết nối song song, địa chỉ theo `printerId`) + `PrinterQueue` (FIFO/printer), và cập nhật toàn bộ call site JS liên quan.

**Architecture:** `PrinterModule` (RN bridge, Promise) → `PrinterManager` (facade) → `PrinterRegistry`/`PrinterQueueManager` → `PrinterDevice` (Usb/Bluetooth/Net) → `PrinterConnection`/`PrinterWriter` → Android API. Nội bộ dùng `CompletableFuture`, JS gọi bằng `printerId` (JS tự sinh qua `generateId()`, không đổi thứ tự flow hiện tại).

**Tech Stack:** Java 17 (Android, React Native New Architecture bridge), TypeScript strict (JS), Jest.

**Spec:** `docs/superpowers/specs/2026-09-08-native-printer-registry-queue-design.md`

## Global Constraints

- Javadoc: khối `/** ... */` nhiều dòng, câu đầu nói đúng chức năng hiện tại (không nhắc version cũ), `@param`/`@return`/`@throws` khi cần. Field: comment 1 dòng ngay trên khai báo.
- Không tự động retry ở native — write thất bại không tự gửi lại (rủi ro in trùng).
- `printerId` luôn do JS truyền vào, native không bao giờ tự sinh.
- Không đổi `PrintScheduler.ts`/`PrinterConnectionLock.ts`/`resourceKey` — 2 hệ thống hàng đợi (native + JS) tồn tại song song, việc gộp là spec khác sau này.
- Không có Java unit test infra trong project (`android/app/src` không có `test`/`androidTest`) — verify tầng Java bằng `./gradlew :app:compileDebugJavaWithJavac` (compile-check), không viết JUnit mới. `JAVA_HOME` phải trỏ `C:\Program Files\Android\Android Studio\jbr` khi chạy `gradlew` (xem `CLAUDE.md`).
- JS verify bằng `npm run verify` (type-check + lint + test).
- Tên module RN không đổi: `NativeModules.ThermalPrinterModule` (chỉ đổi tên file/class Java từ `ThermalPrinterModule` sang `PrinterModule`).

---

## Task 1: Core value/enum types (`printer/`)

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterState.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/CapabilityState.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterResult.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterInfo.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterCapabilities.java`

**Interfaces:**
- Produces: `PrinterState` enum (`CONNECTING, CONNECTED, DISCONNECTING, DISCONNECTED, ERROR`); `CapabilityState` enum (`SUPPORTED, UNSUPPORTED, UNKNOWN`); `PrinterResult` (record, `success()`/`failure()` factories, accessors `success()`/`errorCode()`/`message()`/`durationMs()`); `PrinterInfo` (record, accessors `printerId()`/`connectionType()`/`name()`/`manufacturerName()`/`productName()`/`vendorId()`/`productId()`/`serialNumber()`/`bluetoothAddress()`/`host()`/`port()`); `PrinterCapabilities` (record, accessors `rawWrite()`/`paperStatus()`/`coverStatus()`/`printerStatus()`).

- [ ] **Step 1: Tạo `PrinterState.java`**

```java
package com.ndtcorepos.thermalprinter.printer;

/**
 * Vòng đời 1 printer trong Registry.
 */
public enum PrinterState {
    /** Đang mở kết nối. */
    CONNECTING,
    /** Đã kết nối, sẵn sàng ghi. */
    CONNECTED,
    /** Đang đóng kết nối. */
    DISCONNECTING,
    /** Đã đóng kết nối. */
    DISCONNECTED,
    /** Gặp lỗi kết nối/ghi không phục hồi trong lần thao tác gần nhất. */
    ERROR
}
```

- [ ] **Step 2: Tạo `CapabilityState.java`**

```java
package com.ndtcorepos.thermalprinter.printer;

/**
 * Mức độ chắc chắn của 1 capability đã detect.
 */
public enum CapabilityState {
    /** Chắc chắn hỗ trợ. */
    SUPPORTED,
    /** Chắc chắn không hỗ trợ. */
    UNSUPPORTED,
    /** Native không xác định được — KHÔNG suy ra là không hỗ trợ. */
    UNKNOWN
}
```

- [ ] **Step 3: Tạo `PrinterResult.java`**

```java
package com.ndtcorepos.thermalprinter.printer;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;

/**
 * Kết quả 1 thao tác native (connect/disconnect/...), không kèm dữ liệu nghiệp vụ.
 */
public record PrinterResult(boolean success, PrinterErrorCode errorCode, String message, long durationMs) {

    /**
     * Tạo kết quả thành công.
     *
     * @param durationMs thời gian thực hiện thao tác (mili-giây)
     */
    public static PrinterResult success(long durationMs) {
        return new PrinterResult(true, null, null, durationMs);
    }

    /**
     * Tạo kết quả thất bại.
     *
     * @param errorCode mã lỗi
     * @param message thông điệp lỗi
     * @param durationMs thời gian thực hiện thao tác (mili-giây)
     */
    public static PrinterResult failure(PrinterErrorCode errorCode, String message, long durationMs) {
        return new PrinterResult(false, errorCode, message, durationMs);
    }
}
```

- [ ] **Step 4: Tạo `PrinterInfo.java`**

```java
package com.ndtcorepos.thermalprinter.printer;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Metadata bất biến mô tả 1 printer.
 */
public record PrinterInfo(
        String printerId,
        ConnectionType connectionType,
        String name,
        String manufacturerName,
        String productName,
        Integer vendorId,
        Integer productId,
        String serialNumber,
        String bluetoothAddress,
        String host,
        Integer port) {
}
```

- [ ] **Step 5: Tạo `PrinterCapabilities.java`**

```java
package com.ndtcorepos.thermalprinter.printer;

/**
 * Khả năng của printer mà native có thể quan sát được — không mô tả protocol.
 */
public record PrinterCapabilities(
        CapabilityState rawWrite,
        CapabilityState paperStatus,
        CapabilityState coverStatus,
        CapabilityState printerStatus) {
}
```

- [ ] **Step 6: Verify compile**

Run (từ thư mục `android/`): `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL (các file mới không được tham chiếu ở đâu, chỉ cần không lỗi cú pháp/import).

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterState.java android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/CapabilityState.java android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterResult.java android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterInfo.java android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterCapabilities.java
git commit -m "feat: add core printer value types (State/Result/Info/Capabilities)"
```

---

## Task 2: Error codes + exception hierarchy

**Files:**
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorCode.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterConnectionException.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterPermissionException.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterWriteException.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterTimeoutException.java`

**Interfaces:**
- Consumes: `error.PrinterException(PrinterErrorCode, String)` / `(PrinterErrorCode, String, Throwable)` constructors (giữ nguyên, không đổi).
- Produces: `PrinterErrorCode` bổ sung các giá trị mới (giữ `DEVICE_NOT_FOUND`/`DEVICE_NOT_CONNECTED` cũ tạm thời — xoá ở Task 11). 4 exception con `exception.PrinterConnectionException`/`PrinterPermissionException`/`PrinterWriteException`/`PrinterTimeoutException`, mỗi cái `extends error.PrinterException`, constructor pass-through.

- [ ] **Step 1: Cập nhật `PrinterErrorCode.java`** — thêm giá trị mới, GIỮ `DEVICE_NOT_FOUND`/`DEVICE_NOT_CONNECTED` (code cũ còn dùng tới Task 11)

```java
package com.ndtcorepos.thermalprinter.error;

public enum PrinterErrorCode {
    NONE,
    INVALID_ARGUMENT,
    UNSUPPORTED_CONNECTION,

    DEVICE_NOT_FOUND,
    DEVICE_NOT_CONNECTED,

    PRINTER_NOT_FOUND,
    PRINTER_BUSY,

    PERMISSION_DENIED,
    PERMISSION_REQUIRED,

    DISCOVERY_FAILED,
    CONNECTION_FAILED,
    CONNECTION_TIMEOUT,

    NOT_CONNECTED,
    WRITE_FAILED,
    WRITE_TIMEOUT,

    USB_DEVICE_NOT_FOUND,
    USB_ENDPOINT_NOT_FOUND,
    USB_INTERFACE_CLAIM_FAILED,

    BLUETOOTH_DEVICE_NOT_FOUND,
    BLUETOOTH_CONNECTION_FAILED,

    NETWORK_CONNECTION_FAILED,
    NETWORK_TIMEOUT,

    JOB_CANCELLED,
    UNKNOWN_ERROR
}
```

- [ ] **Step 2: Tạo `exception/PrinterConnectionException.java`**

```java
package com.ndtcorepos.thermalprinter.exception;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Lỗi khi mở/đóng kết nối.
 */
public class PrinterConnectionException extends PrinterException {

    public PrinterConnectionException(PrinterErrorCode code, String message) {
        super(code, message);
    }

    public PrinterConnectionException(PrinterErrorCode code, String message, Throwable cause) {
        super(code, message, cause);
    }
}
```

- [ ] **Step 3: Tạo `exception/PrinterPermissionException.java`**

```java
package com.ndtcorepos.thermalprinter.exception;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Lỗi liên quan permission Android (USB).
 */
public class PrinterPermissionException extends PrinterException {

    public PrinterPermissionException(PrinterErrorCode code, String message) {
        super(code, message);
    }

    public PrinterPermissionException(PrinterErrorCode code, String message, Throwable cause) {
        super(code, message, cause);
    }
}
```

- [ ] **Step 4: Tạo `exception/PrinterWriteException.java`**

```java
package com.ndtcorepos.thermalprinter.exception;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Lỗi khi ghi dữ liệu.
 */
public class PrinterWriteException extends PrinterException {

    public PrinterWriteException(PrinterErrorCode code, String message) {
        super(code, message);
    }

    public PrinterWriteException(PrinterErrorCode code, String message, Throwable cause) {
        super(code, message, cause);
    }
}
```

- [ ] **Step 5: Tạo `exception/PrinterTimeoutException.java`**

```java
package com.ndtcorepos.thermalprinter.exception;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Vượt quá thời gian chờ (connect/write/socket).
 */
public class PrinterTimeoutException extends PrinterException {

    public PrinterTimeoutException(PrinterErrorCode code, String message) {
        super(code, message);
    }

    public PrinterTimeoutException(PrinterErrorCode code, String message, Throwable cause) {
        super(code, message, cause);
    }
}
```

- [ ] **Step 6: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorCode.java android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/
git commit -m "feat: expand PrinterErrorCode, add exception hierarchy"
```

---

## Task 3: `PrinterConnection`/`PrinterWriter` interfaces (`transport/`)

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/PrinterConnection.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/PrinterWriter.java`

**Interfaces:**
- Consumes: `printer.PrinterResult` (Task 1).
- Produces: `transport.PrinterConnection` (`open()`/`close()`/`isOpen()`), `transport.PrinterWriter` (`write(byte[])`) — dùng bởi Task 4-6.

- [ ] **Step 1: Tạo `PrinterConnection.java`**

```java
package com.ndtcorepos.thermalprinter.transport;

import com.ndtcorepos.thermalprinter.printer.PrinterResult;

import java.util.concurrent.CompletableFuture;

/**
 * Lifecycle của 1 kênh giao tiếp với printer — không ghi dữ liệu.
 */
public interface PrinterConnection {

    /**
     * Mở kênh giao tiếp.
     */
    CompletableFuture<PrinterResult> open();

    /**
     * Đóng kênh giao tiếp — gọi nhiều lần không lỗi (idempotent).
     */
    CompletableFuture<PrinterResult> close();

    /**
     * Kênh có đang mở không.
     */
    boolean isOpen();
}
```

- [ ] **Step 2: Tạo `PrinterWriter.java`**

```java
package com.ndtcorepos.thermalprinter.transport;

import com.ndtcorepos.thermalprinter.printer.PrinterResult;

import java.util.concurrent.CompletableFuture;

/**
 * Ghi raw bytes trên 1 kênh đã mở.
 */
public interface PrinterWriter {

    /**
     * Ghi bytes — ném lỗi nếu kênh chưa mở hoặc ghi thất bại.
     *
     * @param data dữ liệu cần ghi
     */
    CompletableFuture<PrinterResult> write(byte[] data);
}
```

- [ ] **Step 3: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/PrinterConnection.java android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/PrinterWriter.java
git commit -m "feat: add PrinterConnection/PrinterWriter interfaces"
```

---

## Task 4: USB transport (`transport/usb/`)

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbEndpointResolver.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbConnection.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbWriter.java`

**Interfaces:**
- Consumes: `permission.UsbPermission` (`hasPermission`/`requestPermission`, giữ nguyên); `discovery.usb.UsbPrinterDiscovery.findBulkOutInterface/findBulkOutEndpoint/isPrintableUsbDevice` (static, giữ nguyên); `exception.PrinterConnectionException`; `printer.PrinterResult`; `transport.PrinterConnection`/`PrinterWriter`.
- Produces: `UsbConnection(ReactApplicationContext, UsbPermission, UsbEndpointResolver, int vendorId, int productId)`; `UsbWriter(UsbConnection, UsbEndpointResolver)`. `UsbConnection` expose package-private `ensureClaimed()`/`getDeviceConnection()`/`getClaimedInterface()` cho `UsbWriter` (mở lười khi write nếu permission vừa được cấp).

- [ ] **Step 1: Tạo `UsbEndpointResolver.java`**

```java
package com.ndtcorepos.thermalprinter.transport.usb;

import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;

import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;

/**
 * Tìm bulk OUT endpoint hợp lệ để ghi dữ liệu tới printer.
 */
public final class UsbEndpointResolver {

    /**
     * Tìm interface có bulk OUT endpoint.
     *
     * @param device thiết bị USB
     * @return interface đã resolve
     * @throws PrinterConnectionException USB_ENDPOINT_NOT_FOUND khi không tìm thấy interface hợp lệ
     */
    public UsbInterface resolveInterface(UsbDevice device) throws PrinterConnectionException {
        UsbInterface usbInterface = UsbPrinterDiscovery.findBulkOutInterface(device);
        if (usbInterface == null) {
            throw new PrinterConnectionException(PrinterErrorCode.USB_ENDPOINT_NOT_FOUND, "USB device has no bulk OUT endpoint");
        }
        return usbInterface;
    }

    /**
     * Tìm endpoint OUT trong 1 interface đã resolve.
     *
     * @param usbInterface interface đã tìm qua resolveInterface
     * @return endpoint OUT
     * @throws PrinterConnectionException USB_ENDPOINT_NOT_FOUND khi không tìm thấy endpoint hợp lệ
     */
    public UsbEndpoint resolveEndpoint(UsbInterface usbInterface) throws PrinterConnectionException {
        UsbEndpoint endpoint = UsbPrinterDiscovery.findBulkOutEndpoint(usbInterface);
        if (endpoint == null) {
            throw new PrinterConnectionException(PrinterErrorCode.USB_ENDPOINT_NOT_FOUND, "USB interface has no bulk OUT endpoint");
        }
        return endpoint;
    }
}
```

- [ ] **Step 2: Tạo `UsbConnection.java`**

```java
package com.ndtcorepos.thermalprinter.transport.usb;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;

import java.util.concurrent.CompletableFuture;

/**
 * Quản lý vòng đời kết nối USB — permission, mở/đóng UsbDeviceConnection, claim interface.
 */
public final class UsbConnection implements PrinterConnection {

    private final UsbManager usbManager;
    private final UsbPermission permission;
    private final UsbEndpointResolver endpointResolver;
    private final int vendorId;
    private final int productId;

    private UsbDevice usbDevice;
    private UsbDeviceConnection deviceConnection;
    private UsbInterface claimedInterface;

    public UsbConnection(ReactApplicationContext context, UsbPermission permission, UsbEndpointResolver endpointResolver, int vendorId, int productId) {
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        this.permission = permission;
        this.endpointResolver = endpointResolver;
        this.vendorId = vendorId;
        this.productId = productId;
    }

    /**
     * Mở kết nối USB — xin permission nếu chưa có, sau đó claim interface.
     *
     * <p>Xin permission là bất đồng bộ (dialog hệ thống) — future resolve
     * ngay sau khi gọi requestPermission(), không đợi user bấm "Cho phép".
     * Việc mở UsbDeviceConnection/claimInterface thật diễn ra ngay nếu đã
     * có quyền; nếu chưa có, lùi lại lần write() đầu tiên qua
     * ensureClaimed() (permission lúc đó thường đã được cấp).</p>
     */
    @Override
    public CompletableFuture<PrinterResult> open() {
        long startedAt = System.currentTimeMillis();
        UsbDevice candidate = findCandidate();
        if (candidate == null) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(
                    PrinterErrorCode.USB_DEVICE_NOT_FOUND, "Can not find USB device vendorId=" + vendorId + " productId=" + productId));
        }
        this.usbDevice = candidate;

        if (!permission.hasPermission(candidate)) {
            permission.requestPermission(candidate);
            return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
        }

        try {
            claim(candidate);
        } catch (PrinterConnectionException e) {
            return CompletableFuture.failedFuture(e);
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    private UsbDevice findCandidate() {
        if (usbManager == null) {
            return null;
        }
        for (UsbDevice candidate : usbManager.getDeviceList().values()) {
            if (candidate.getVendorId() == vendorId && candidate.getProductId() == productId
                    && UsbPrinterDiscovery.isPrintableUsbDevice(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private void claim(UsbDevice device) throws PrinterConnectionException {
        UsbInterface usbInterface = endpointResolver.resolveInterface(device);
        UsbDeviceConnection newConnection = usbManager.openDevice(device);
        if (newConnection == null) {
            throw new PrinterConnectionException(PrinterErrorCode.CONNECTION_FAILED, "Failed to open USB connection");
        }
        if (!newConnection.claimInterface(usbInterface, true)) {
            newConnection.close();
            throw new PrinterConnectionException(PrinterErrorCode.USB_INTERFACE_CLAIM_FAILED, "Failed to claim USB interface");
        }
        this.deviceConnection = newConnection;
        this.claimedInterface = usbInterface;
    }

    /**
     * Đảm bảo đã claim interface thật — gọi lười từ UsbWriter lúc write()
     * đầu tiên, vì lúc open() permission có thể chưa được cấp xong.
     */
    boolean ensureClaimed() {
        if (isOpen()) {
            return true;
        }
        if (usbDevice == null || !permission.hasPermission(usbDevice)) {
            return false;
        }
        try {
            claim(usbDevice);
            return true;
        } catch (PrinterConnectionException e) {
            return false;
        }
    }

    UsbDeviceConnection getDeviceConnection() {
        return deviceConnection;
    }

    UsbInterface getClaimedInterface() {
        return claimedInterface;
    }

    /**
     * Đóng kết nối USB và release interface.
     */
    @Override
    public CompletableFuture<PrinterResult> close() {
        long startedAt = System.currentTimeMillis();
        if (deviceConnection != null) {
            if (claimedInterface != null) {
                try {
                    deviceConnection.releaseInterface(claimedInterface);
                } catch (Exception ignored) {
                }
            }
            try {
                deviceConnection.close();
            } catch (Exception ignored) {
            }
        }
        claimedInterface = null;
        deviceConnection = null;
        usbDevice = null;
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    /**
     * Kết nối USB có đang mở không.
     */
    @Override
    public boolean isOpen() {
        return deviceConnection != null && claimedInterface != null;
    }
}
```

- [ ] **Step 3: Tạo `UsbWriter.java`**

```java
package com.ndtcorepos.thermalprinter.transport.usb;

import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.util.Log;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.exception.PrinterWriteException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.util.concurrent.CompletableFuture;

/**
 * Ghi bytes qua bulk OUT endpoint USB.
 */
public final class UsbWriter implements PrinterWriter {

    private static final String TAG = "UsbWriter";
    private static final int BULK_TRANSFER_TIMEOUT_MS = 100000;

    private final UsbConnection connection;
    private final UsbEndpointResolver endpointResolver;

    public UsbWriter(UsbConnection connection, UsbEndpointResolver endpointResolver) {
        this.connection = connection;
        this.endpointResolver = endpointResolver;
    }

    /**
     * Ghi bytes qua bulk transfer.
     *
     * @param data dữ liệu cần ghi
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        long startedAt = System.currentTimeMillis();
        if (!connection.ensureClaimed()) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(
                    PrinterErrorCode.CONNECTION_FAILED, "USB connection is not ready — permission may still be pending"));
        }

        UsbDeviceConnection deviceConnection = connection.getDeviceConnection();
        UsbInterface claimedInterface = connection.getClaimedInterface();
        try {
            UsbEndpoint endpoint = endpointResolver.resolveEndpoint(claimedInterface);
            int result = deviceConnection.bulkTransfer(endpoint, data, data.length, BULK_TRANSFER_TIMEOUT_MS);
            Log.i(TAG, "bulkTransfer result=" + result);
            if (result < 0) {
                return CompletableFuture.failedFuture(new PrinterWriteException(PrinterErrorCode.WRITE_FAILED, "USB bulk transfer failed"));
            }
        } catch (PrinterConnectionException e) {
            return CompletableFuture.failedFuture(e);
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }
}
```

- [ ] **Step 4: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/
git commit -m "feat: add USB PrinterConnection/PrinterWriter (UsbConnection/UsbWriter)"
```

---

## Task 5: Bluetooth transport (`transport/bluetooth/`)

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothConnection.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothWriter.java`

**Interfaces:**
- Produces: `BluetoothConnection(String address)`, `BluetoothWriter(BluetoothConnection)`.

- [ ] **Step 1: Tạo `BluetoothConnection.java`**

```java
package com.ndtcorepos.thermalprinter.transport.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Quản lý vòng đời socket RFCOMM Bluetooth.
 */
public final class BluetoothConnection implements PrinterConnection {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

    private final String address;
    private BluetoothSocket socket;
    private int pendingDrainBytes = -1;

    public BluetoothConnection(String address) {
        this.address = address;
    }

    /**
     * Mở socket RFCOMM tới địa chỉ Bluetooth đã cấu hình.
     */
    @Override
    public CompletableFuture<PrinterResult> open() {
        long startedAt = System.currentTimeMillis();
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.CONNECTION_FAILED, "No bluetooth adapter available"));
        }
        if (!adapter.isEnabled()) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.CONNECTION_FAILED, "Bluetooth is not enabled"));
        }

        BluetoothDevice bondedDevice = findBondedDevice(adapter);
        if (bondedDevice == null) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.BLUETOOTH_DEVICE_NOT_FOUND,
                    "Can not find the specified printing device, please pair it in system Bluetooth settings first."));
        }

        closeQuietly();
        try {
            this.socket = openSocket(bondedDevice);
        } catch (IOException e) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.BLUETOOTH_CONNECTION_FAILED,
                    "Failed to connect bluetooth printer: " + e.getMessage(), e));
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    private BluetoothDevice findBondedDevice(BluetoothAdapter adapter) {
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        for (BluetoothDevice candidate : bonded) {
            if (candidate.getAddress().equals(address)) {
                return candidate;
            }
        }
        return null;
    }

    private BluetoothSocket openSocket(BluetoothDevice target) throws IOException {
        BluetoothSocket newSocket = target.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            newSocket.connect();
            return newSocket;
        } catch (IOException e) {
            try {
                newSocket.close();
            } catch (IOException ignored) {
            }
            BluetoothSocket retrySocket = target.createRfcommSocketToServiceRecord(SPP_UUID);
            retrySocket.connect();
            return retrySocket;
        }
    }

    OutputStream getOutputStream() throws IOException {
        return socket.getOutputStream();
    }

    void markPendingDrain(int bytes) {
        this.pendingDrainBytes = bytes;
    }

    private void closeQuietly() {
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }
    }

    /**
     * Đóng socket Bluetooth.
     *
     * <p>Nếu vừa ghi xong (pendingDrainBytes >= 0), chờ 1 khoảng thời gian
     * tỷ lệ số byte trước khi đóng — đóng ngay sau khi ghi có thể cắt dữ
     * liệu chưa kịp truyền hết qua RFCOMM.</p>
     */
    @Override
    public CompletableFuture<PrinterResult> close() {
        long startedAt = System.currentTimeMillis();
        if (socket != null && pendingDrainBytes >= 0) {
            sleepForDrain(pendingDrainBytes);
            pendingDrainBytes = -1;
        }
        closeQuietly();
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    private void sleepForDrain(int bytes) {
        try {
            Thread.sleep(bytes <= 2000 ? 100 : bytes / 5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Socket có đang kết nối không.
     */
    @Override
    public boolean isOpen() {
        return socket != null && socket.isConnected();
    }
}
```

- [ ] **Step 2: Tạo `BluetoothWriter.java`**

```java
package com.ndtcorepos.thermalprinter.transport.bluetooth;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.exception.PrinterWriteException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.CompletableFuture;

/**
 * Ghi bytes qua OutputStream của socket Bluetooth.
 */
public final class BluetoothWriter implements PrinterWriter {

    private final BluetoothConnection connection;

    public BluetoothWriter(BluetoothConnection connection) {
        this.connection = connection;
    }

    /**
     * Ghi bytes rồi flush OutputStream.
     *
     * @param data dữ liệu cần ghi
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        long startedAt = System.currentTimeMillis();
        if (!connection.isOpen()) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.NOT_CONNECTED,
                    "Bluetooth connection is not built, may be you forgot to connect"));
        }
        try {
            OutputStream out = connection.getOutputStream();
            out.write(data);
            out.flush();
            connection.markPendingDrain(data.length);
        } catch (IOException e) {
            return CompletableFuture.failedFuture(new PrinterWriteException(PrinterErrorCode.WRITE_FAILED, "Failed to write data: " + e.getMessage(), e));
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }
}
```

- [ ] **Step 3: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/
git commit -m "feat: add Bluetooth PrinterConnection/PrinterWriter"
```

---

## Task 6: Net transport (`transport/net/`)

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/net/NetConnection.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/net/NetWriter.java`

**Interfaces:**
- Produces: `NetConnection(String host, int port)`, `NetWriter(NetConnection)`.

- [ ] **Step 1: Tạo `NetConnection.java`**

```java
package com.ndtcorepos.thermalprinter.transport.net;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;

import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;
import java.util.concurrent.CompletableFuture;

/**
 * Quản lý vòng đời kết nối TCP tới printer mạng.
 */
public final class NetConnection implements PrinterConnection {

    private final String host;
    private final int port;
    private Socket socket;

    public NetConnection(String host, int port) {
        this.host = host;
        this.port = port;
    }

    /**
     * Mở socket TCP tới host/port đã cấu hình.
     */
    @Override
    public CompletableFuture<PrinterResult> open() {
        long startedAt = System.currentTimeMillis();
        closeQuietly();
        try {
            Socket newSocket = new Socket(host, port);
            if (!newSocket.isConnected()) {
                return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.NETWORK_CONNECTION_FAILED,
                        "Unable to build connection with host: " + host + ", port: " + port));
            }
            this.socket = newSocket;
        } catch (IOException e) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.NETWORK_CONNECTION_FAILED,
                    "Failed to connect printer: " + e.getMessage(), e));
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    OutputStream getOutputStream() throws IOException {
        return socket.getOutputStream();
    }

    private void closeQuietly() {
        if (socket != null && !socket.isClosed()) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
        socket = null;
    }

    /**
     * Đóng socket TCP.
     */
    @Override
    public CompletableFuture<PrinterResult> close() {
        long startedAt = System.currentTimeMillis();
        closeQuietly();
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    /**
     * Socket có đang kết nối không.
     */
    @Override
    public boolean isOpen() {
        return socket != null && !socket.isClosed();
    }
}
```

- [ ] **Step 2: Tạo `NetWriter.java`**

```java
package com.ndtcorepos.thermalprinter.transport.net;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.exception.PrinterWriteException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.CompletableFuture;

/**
 * Ghi bytes qua OutputStream TCP.
 */
public final class NetWriter implements PrinterWriter {

    private final NetConnection connection;

    public NetWriter(NetConnection connection) {
        this.connection = connection;
    }

    /**
     * Ghi bytes rồi flush OutputStream.
     *
     * @param data dữ liệu cần ghi
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        long startedAt = System.currentTimeMillis();
        if (!connection.isOpen()) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.NOT_CONNECTED,
                    "LAN connection is not built, may be you forgot to connect"));
        }
        try {
            OutputStream out = connection.getOutputStream();
            out.write(data);
            out.flush();
        } catch (IOException e) {
            return CompletableFuture.failedFuture(new PrinterWriteException(PrinterErrorCode.WRITE_FAILED, "Failed to write data: " + e.getMessage(), e));
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }
}
```

- [ ] **Step 3: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/net/
git commit -m "feat: add Net PrinterConnection/PrinterWriter"
```

---

## Task 7: `PrinterDevice` interface + 3 implementations (`printer/`, `device/`)

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterDevice.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/UsbPrinterDevice.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/BluetoothPrinterDevice.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/NetPrinterDevice.java`

**Interfaces:**
- Consumes: `printer.PrinterInfo`/`PrinterResult`/`PrinterState` (Task 1), `transport.PrinterConnection`/`PrinterWriter` (Task 3-6).
- Produces: `printer.PrinterDevice` (`getInfo()`/`getState()`/`isConnected()`/`connect()`/`disconnect()`/`write(byte[])`), dùng bởi `PrinterManager` (Task 11).

- [ ] **Step 1: Tạo `printer/PrinterDevice.java`**

```java
package com.ndtcorepos.thermalprinter.printer;

import java.util.concurrent.CompletableFuture;

/**
 * Đại diện 1 printer cụ thể — điều phối connection/writer, không tự biết protocol.
 */
public interface PrinterDevice {

    /**
     * Metadata của printer này.
     */
    PrinterInfo getInfo();

    /**
     * Trạng thái vòng đời hiện tại.
     */
    PrinterState getState();

    /**
     * Đang kết nối không.
     */
    boolean isConnected();

    /**
     * Mở kết nối — idempotent nếu đã CONNECTED.
     */
    CompletableFuture<PrinterResult> connect();

    /**
     * Đóng kết nối — idempotent nếu đã DISCONNECTED.
     */
    CompletableFuture<PrinterResult> disconnect();

    /**
     * Ghi raw bytes — không tự động connect lại nếu chưa kết nối.
     *
     * @param data dữ liệu cần ghi
     */
    CompletableFuture<PrinterResult> write(byte[] data);
}
```

- [ ] **Step 2: Tạo `device/UsbPrinterDevice.java`**

```java
package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.printer.PrinterDevice;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.printer.PrinterState;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.util.concurrent.CompletableFuture;

/**
 * PrinterDevice cho kết nối USB — phối hợp UsbConnection + UsbWriter.
 */
public final class UsbPrinterDevice implements PrinterDevice {

    private final PrinterInfo info;
    private final PrinterConnection connection;
    private final PrinterWriter writer;
    private volatile PrinterState state = PrinterState.CONNECTING;

    public UsbPrinterDevice(PrinterInfo info, PrinterConnection connection, PrinterWriter writer) {
        this.info = info;
        this.connection = connection;
        this.writer = writer;
    }

    @Override
    public PrinterInfo getInfo() {
        return info;
    }

    @Override
    public PrinterState getState() {
        return state;
    }

    @Override
    public boolean isConnected() {
        return state == PrinterState.CONNECTED;
    }

    @Override
    public CompletableFuture<PrinterResult> connect() {
        if (isConnected()) {
            return CompletableFuture.completedFuture(PrinterResult.success(0));
        }
        state = PrinterState.CONNECTING;
        return connection.open().whenComplete((result, error) -> state = error == null ? PrinterState.CONNECTED : PrinterState.ERROR);
    }

    @Override
    public CompletableFuture<PrinterResult> disconnect() {
        if (state == PrinterState.DISCONNECTED) {
            return CompletableFuture.completedFuture(PrinterResult.success(0));
        }
        state = PrinterState.DISCONNECTING;
        return connection.close().whenComplete((result, error) -> state = PrinterState.DISCONNECTED);
    }

    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        return writer.write(data);
    }
}
```

- [ ] **Step 3: Tạo `device/BluetoothPrinterDevice.java`**

```java
package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.printer.PrinterDevice;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.printer.PrinterState;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.util.concurrent.CompletableFuture;

/**
 * PrinterDevice cho kết nối Bluetooth — phối hợp BluetoothConnection + BluetoothWriter.
 */
public final class BluetoothPrinterDevice implements PrinterDevice {

    private final PrinterInfo info;
    private final PrinterConnection connection;
    private final PrinterWriter writer;
    private volatile PrinterState state = PrinterState.CONNECTING;

    public BluetoothPrinterDevice(PrinterInfo info, PrinterConnection connection, PrinterWriter writer) {
        this.info = info;
        this.connection = connection;
        this.writer = writer;
    }

    @Override
    public PrinterInfo getInfo() {
        return info;
    }

    @Override
    public PrinterState getState() {
        return state;
    }

    @Override
    public boolean isConnected() {
        return state == PrinterState.CONNECTED;
    }

    @Override
    public CompletableFuture<PrinterResult> connect() {
        if (isConnected()) {
            return CompletableFuture.completedFuture(PrinterResult.success(0));
        }
        state = PrinterState.CONNECTING;
        return connection.open().whenComplete((result, error) -> state = error == null ? PrinterState.CONNECTED : PrinterState.ERROR);
    }

    @Override
    public CompletableFuture<PrinterResult> disconnect() {
        if (state == PrinterState.DISCONNECTED) {
            return CompletableFuture.completedFuture(PrinterResult.success(0));
        }
        state = PrinterState.DISCONNECTING;
        return connection.close().whenComplete((result, error) -> state = PrinterState.DISCONNECTED);
    }

    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        return writer.write(data);
    }
}
```

- [ ] **Step 4: Tạo `device/NetPrinterDevice.java`**

```java
package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.printer.PrinterDevice;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.printer.PrinterState;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;
import com.ndtcorepos.thermalprinter.transport.PrinterWriter;

import java.util.concurrent.CompletableFuture;

/**
 * PrinterDevice cho kết nối LAN — phối hợp NetConnection + NetWriter.
 */
public final class NetPrinterDevice implements PrinterDevice {

    private final PrinterInfo info;
    private final PrinterConnection connection;
    private final PrinterWriter writer;
    private volatile PrinterState state = PrinterState.CONNECTING;

    public NetPrinterDevice(PrinterInfo info, PrinterConnection connection, PrinterWriter writer) {
        this.info = info;
        this.connection = connection;
        this.writer = writer;
    }

    @Override
    public PrinterInfo getInfo() {
        return info;
    }

    @Override
    public PrinterState getState() {
        return state;
    }

    @Override
    public boolean isConnected() {
        return state == PrinterState.CONNECTED;
    }

    @Override
    public CompletableFuture<PrinterResult> connect() {
        if (isConnected()) {
            return CompletableFuture.completedFuture(PrinterResult.success(0));
        }
        state = PrinterState.CONNECTING;
        return connection.open().whenComplete((result, error) -> state = error == null ? PrinterState.CONNECTED : PrinterState.ERROR);
    }

    @Override
    public CompletableFuture<PrinterResult> disconnect() {
        if (state == PrinterState.DISCONNECTED) {
            return CompletableFuture.completedFuture(PrinterResult.success(0));
        }
        state = PrinterState.DISCONNECTING;
        return connection.close().whenComplete((result, error) -> state = PrinterState.DISCONNECTED);
    }

    @Override
    public CompletableFuture<PrinterResult> write(byte[] data) {
        return writer.write(data);
    }
}
```

- [ ] **Step 5: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterDevice.java android/app/src/main/java/com/ndtcorepos/thermalprinter/device/
git commit -m "feat: add PrinterDevice interface and Usb/Bluetooth/Net implementations"
```

---

## Task 8: `PrinterRegistry`

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterRegistry.java`

**Interfaces:**
- Consumes: `printer.PrinterDevice` (Task 7).
- Produces: `PrinterRegistry` (`get`/`put`/`remove`/`getAll`), dùng bởi `PrinterQueue` (Task 9) và `PrinterManager` (Task 11).

- [ ] **Step 1: Tạo `PrinterRegistry.java`**

```java
package com.ndtcorepos.thermalprinter.printer;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry thread-safe các printer đang được native quản lý, khoá theo printerId.
 */
public final class PrinterRegistry {

    private final Map<String, PrinterDevice> devices = new ConcurrentHashMap<>();

    /**
     * Tìm printer theo id.
     *
     * @param printerId id cần tìm
     * @return printer tương ứng, null nếu chưa có
     */
    public PrinterDevice get(String printerId) {
        return devices.get(printerId);
    }

    /**
     * Thêm/thay thế printer trong registry.
     *
     * @param printerId khoá đăng ký
     * @param device printer cần lưu
     */
    public void put(String printerId, PrinterDevice device) {
        devices.put(printerId, device);
    }

    /**
     * Xoá printer khỏi registry.
     *
     * @param printerId id cần xoá
     */
    public void remove(String printerId) {
        devices.remove(printerId);
    }

    /**
     * Tất cả printer đang quản lý.
     */
    public List<PrinterDevice> getAll() {
        return List.copyOf(devices.values());
    }
}
```

- [ ] **Step 2: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterRegistry.java
git commit -m "feat: add PrinterRegistry"
```

---

## Task 9: Queue (`queue/`)

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/PrintJob.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/PrintJobResult.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/QueueStatus.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/PrinterQueue.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/PrinterQueueManager.java`

**Interfaces:**
- Consumes: `printer.PrinterRegistry`/`PrinterDevice`/`PrinterResult` (Task 1, 7, 8), `error.PrinterErrorCode`, `error.PrinterException`.
- Produces: `PrinterQueueManager(PrinterRegistry)` với `getOrCreate(printerId)`/`getIfExists(printerId)`/`cancel(jobId)`/`shutdownAll()`, dùng bởi `PrinterManager` (Task 11).

- [ ] **Step 1: Tạo `PrintJob.java`**

```java
package com.ndtcorepos.thermalprinter.queue;

/**
 * 1 lệnh ghi đã được đưa vào hàng đợi.
 */
public record PrintJob(String jobId, String printerId, byte[] data, long createdAt) {
}
```

- [ ] **Step 2: Tạo `PrintJobResult.java`**

```java
package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;

/**
 * Kết quả cuối cùng của 1 PrintJob.
 */
public record PrintJobResult(String jobId, String printerId, boolean success, PrinterErrorCode errorCode, String message, long durationMs) {

    /**
     * Tạo kết quả thành công.
     *
     * @param jobId id job
     * @param printerId printer đích
     * @param durationMs thời gian thực thi (mili-giây)
     */
    public static PrintJobResult success(String jobId, String printerId, long durationMs) {
        return new PrintJobResult(jobId, printerId, true, null, null, durationMs);
    }

    /**
     * Tạo kết quả thất bại.
     *
     * @param jobId id job
     * @param printerId printer đích
     * @param errorCode mã lỗi
     * @param message thông điệp lỗi
     * @param durationMs thời gian thực thi (mili-giây)
     */
    public static PrintJobResult failure(String jobId, String printerId, PrinterErrorCode errorCode, String message, long durationMs) {
        return new PrintJobResult(jobId, printerId, false, errorCode, message, durationMs);
    }
}
```

- [ ] **Step 3: Tạo `QueueStatus.java`**

```java
package com.ndtcorepos.thermalprinter.queue;

/**
 * Trạng thái hàng đợi tại 1 thời điểm.
 */
public record QueueStatus(int pendingCount, String runningJobId) {
}
```

- [ ] **Step 4: Tạo `PrinterQueue.java`**

```java
package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.PrinterDevice;
import com.ndtcorepos.thermalprinter.printer.PrinterRegistry;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Hàng đợi FIFO cho 1 printer — chạy trên 1 single-thread executor riêng.
 */
public final class PrinterQueue {

    private final String printerId;
    private final PrinterRegistry registry;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Map<String, Future<?>> pendingFutures = new ConcurrentHashMap<>();
    private final AtomicInteger pendingCount = new AtomicInteger(0);
    private volatile String runningJobId;

    public PrinterQueue(String printerId, PrinterRegistry registry) {
        this.printerId = printerId;
        this.registry = registry;
    }

    /**
     * Thêm job vào cuối hàng đợi — thực thi đúng thứ tự FIFO.
     *
     * @param job job cần thực thi
     */
    public CompletableFuture<PrintJobResult> enqueue(PrintJob job) {
        pendingCount.incrementAndGet();
        CompletableFuture<PrintJobResult> resultFuture = new CompletableFuture<>();
        Future<?> submitted = executor.submit(() -> runJob(job, resultFuture));
        pendingFutures.put(job.jobId(), submitted);
        return resultFuture;
    }

    private void runJob(PrintJob job, CompletableFuture<PrintJobResult> resultFuture) {
        pendingCount.decrementAndGet();
        pendingFutures.remove(job.jobId());
        runningJobId = job.jobId();
        long startedAt = System.currentTimeMillis();
        try {
            PrinterDevice device = registry.get(job.printerId());
            if (device == null) {
                resultFuture.complete(PrintJobResult.failure(job.jobId(), job.printerId(), PrinterErrorCode.PRINTER_NOT_FOUND,
                        "Printer not found: " + job.printerId(), System.currentTimeMillis() - startedAt));
                return;
            }
            device.write(job.data()).get();
            resultFuture.complete(PrintJobResult.success(job.jobId(), job.printerId(), System.currentTimeMillis() - startedAt));
        } catch (Exception e) {
            resultFuture.complete(PrintJobResult.failure(job.jobId(), job.printerId(), errorCodeOf(e), e.getMessage(),
                    System.currentTimeMillis() - startedAt));
        } finally {
            runningJobId = null;
        }
    }

    private PrinterErrorCode errorCodeOf(Exception e) {
        Throwable cause = e.getCause() != null ? e.getCause() : e;
        if (cause instanceof PrinterException printerException) {
            return printerException.getCode();
        }
        return PrinterErrorCode.UNKNOWN_ERROR;
    }

    /**
     * Huỷ job — chỉ thành công nếu job còn PENDING (chưa tới lượt chạy).
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công
     */
    public boolean cancel(String jobId) {
        Future<?> future = pendingFutures.remove(jobId);
        if (future == null) {
            return false;
        }
        boolean cancelled = future.cancel(false);
        if (cancelled) {
            pendingCount.decrementAndGet();
        }
        return cancelled;
    }

    /**
     * Số job đang chờ và job đang chạy (nếu có).
     */
    public QueueStatus status() {
        return new QueueStatus(pendingCount.get(), runningJobId);
    }

    /**
     * Đóng executor — không nhận job mới.
     */
    public void shutdown() {
        executor.shutdown();
    }
}
```

- [ ] **Step 5: Tạo `PrinterQueueManager.java`**

```java
package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.printer.PrinterRegistry;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Map printerId → PrinterQueue, tạo lười khi có job đầu tiên cho 1 printerId.
 */
public final class PrinterQueueManager {

    private final PrinterRegistry registry;
    private final Map<String, PrinterQueue> queues = new ConcurrentHashMap<>();

    public PrinterQueueManager(PrinterRegistry registry) {
        this.registry = registry;
    }

    /**
     * Lấy queue của 1 printer, tạo mới nếu chưa có.
     *
     * @param printerId printer cần lấy queue
     * @return queue tương ứng
     */
    public PrinterQueue getOrCreate(String printerId) {
        return queues.computeIfAbsent(printerId, id -> new PrinterQueue(id, registry));
    }

    /**
     * Lấy queue của 1 printer NẾU đã tồn tại — không tự tạo mới (dùng cho
     * getQueueStatus, tránh spin lên 1 executor thừa chỉ để hỏi trạng thái).
     *
     * @param printerId printer cần tra cứu
     * @return queue tương ứng, null nếu chưa từng có job nào
     */
    public PrinterQueue getIfExists(String printerId) {
        return queues.get(printerId);
    }

    /**
     * Huỷ 1 job theo id — tìm trong tất cả queue đang quản lý.
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công
     */
    public boolean cancel(String jobId) {
        for (PrinterQueue queue : queues.values()) {
            if (queue.cancel(jobId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Đóng tất cả queue đang quản lý.
     */
    public void shutdownAll() {
        queues.values().forEach(PrinterQueue::shutdown);
    }
}
```

- [ ] **Step 6: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/
git commit -m "feat: add PrinterQueue/PrinterQueueManager (per-printer FIFO)"
```

---

## Task 10: `CapabilityDetector` (`detector/`)

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/CapabilityDetector.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/UsbCapabilityDetector.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/BluetoothCapabilityDetector.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/NetCapabilityDetector.java`

**Interfaces:**
- Consumes: `printer.PrinterInfo`/`PrinterCapabilities`/`CapabilityState` (Task 1).
- Produces: `CapabilityDetector.detect(PrinterInfo): PrinterCapabilities`, dùng bởi `PrinterManager` (Task 11).

- [ ] **Step 1: Tạo `CapabilityDetector.java`**

```java
package com.ndtcorepos.thermalprinter.detector;

import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

/**
 * Phát hiện capability quan sát được từ native — không suy đoán, không biết protocol.
 */
public interface CapabilityDetector {

    /**
     * Phát hiện capability cho 1 printer.
     *
     * @param info metadata printer
     */
    PrinterCapabilities detect(PrinterInfo info);
}
```

- [ ] **Step 2: Tạo `UsbCapabilityDetector.java`**

```java
package com.ndtcorepos.thermalprinter.detector;

import com.ndtcorepos.thermalprinter.printer.CapabilityState;
import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

/**
 * CapabilityDetector cho printer USB — chưa có logic đọc status thật, trả UNKNOWN.
 */
public final class UsbCapabilityDetector implements CapabilityDetector {

    @Override
    public PrinterCapabilities detect(PrinterInfo info) {
        return new PrinterCapabilities(CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN);
    }
}
```

- [ ] **Step 3: Tạo `BluetoothCapabilityDetector.java`**

```java
package com.ndtcorepos.thermalprinter.detector;

import com.ndtcorepos.thermalprinter.printer.CapabilityState;
import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

/**
 * CapabilityDetector cho printer Bluetooth — chưa có logic đọc status thật, trả UNKNOWN.
 */
public final class BluetoothCapabilityDetector implements CapabilityDetector {

    @Override
    public PrinterCapabilities detect(PrinterInfo info) {
        return new PrinterCapabilities(CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN);
    }
}
```

- [ ] **Step 4: Tạo `NetCapabilityDetector.java`**

```java
package com.ndtcorepos.thermalprinter.detector;

import com.ndtcorepos.thermalprinter.printer.CapabilityState;
import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

/**
 * CapabilityDetector cho printer LAN — chưa có logic đọc status thật, trả UNKNOWN.
 */
public final class NetCapabilityDetector implements CapabilityDetector {

    @Override
    public PrinterCapabilities detect(PrinterInfo info) {
        return new PrinterCapabilities(CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN, CapabilityState.UNKNOWN);
    }
}
```

- [ ] **Step 5: Verify compile**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/
git commit -m "feat: add CapabilityDetector (Usb/Bluetooth/Net stubs, UNKNOWN)"
```

---

## Task 11: Cutover — `PrinterManager`, `PrinterModule` bridge, Discovery, xoá code cũ

Đây là task atomic duy nhất được phép chạm cả code mới lẫn xoá code cũ cùng lúc — không thể tách nhỏ hơn vì `module/ThermalPrinterPackage.java` chỉ biên dịch được khi CẢ HAI đổi cùng lúc (xoá `ThermalPrinterModule` bắt buộc phải có `PrinterModule` thay thế ngay, nếu không `createNativeModules()` sẽ tham chiếu tới class không tồn tại).

**Files:**
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorCode.java` (xoá `DEVICE_NOT_FOUND`/`DEVICE_NOT_CONNECTED`)
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/IPrinterDiscovery.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/usb/UsbPrinterDiscovery.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDiscovery.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterPackage.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterManager.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/PrinterModule.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/usb/UsbPrinterDevice.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDevice.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterConnection.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/model/IPrinterDevice.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterData.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/IPrinterTransport.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbPrinterTransport.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothPrinterTransport.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/network/NetworkPrinterTransport.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/application/PrinterService.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/application/PrinterServiceFactory.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java`

**Interfaces:**
- Consumes: mọi thứ từ Task 1-10.
- Produces: `PrinterManager` (facade đầy đủ theo spec mục 8), `PrinterModule` (bridge RN, `getName() == "ThermalPrinterModule"`).

- [ ] **Step 1: Xoá `DEVICE_NOT_FOUND`/`DEVICE_NOT_CONNECTED` khỏi `PrinterErrorCode.java`** (không còn consumer nào sau khi xoá code cũ ở step 9-10)

```java
package com.ndtcorepos.thermalprinter.error;

public enum PrinterErrorCode {
    NONE,
    INVALID_ARGUMENT,
    UNSUPPORTED_CONNECTION,

    PRINTER_NOT_FOUND,
    PRINTER_BUSY,

    PERMISSION_DENIED,
    PERMISSION_REQUIRED,

    DISCOVERY_FAILED,
    CONNECTION_FAILED,
    CONNECTION_TIMEOUT,

    NOT_CONNECTED,
    WRITE_FAILED,
    WRITE_TIMEOUT,

    USB_DEVICE_NOT_FOUND,
    USB_ENDPOINT_NOT_FOUND,
    USB_INTERFACE_CLAIM_FAILED,

    BLUETOOTH_DEVICE_NOT_FOUND,
    BLUETOOTH_CONNECTION_FAILED,

    NETWORK_CONNECTION_FAILED,
    NETWORK_TIMEOUT,

    JOB_CANCELLED,
    UNKNOWN_ERROR
}
```

- [ ] **Step 2: Cập nhật `discovery/IPrinterDiscovery.java`**

```java
package com.ndtcorepos.thermalprinter.discovery;

import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

import java.util.List;

/**
 * Tìm các printer khả dụng cho 1 loại kết nối.
 */
public interface IPrinterDiscovery {

    /**
     * Quét thiết bị khả dụng.
     *
     * @throws PrinterException DISCOVERY_FAILED nếu hệ thống USB/Bluetooth không sẵn sàng
     */
    List<PrinterInfo> discover() throws PrinterException;
}
```

- [ ] **Step 3: Cập nhật `discovery/usb/UsbPrinterDiscovery.java`** — trả `PrinterInfo` trực tiếp, giữ nguyên 3 static helper (`isPrintableUsbDevice`/`findBulkOutInterface`/`findBulkOutEndpoint`, dùng bởi Task 4)

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
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

import java.util.ArrayList;
import java.util.List;

public final class UsbPrinterDiscovery implements IPrinterDiscovery {

    private final UsbManager usbManager;

    public UsbPrinterDiscovery(ReactApplicationContext context) {
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    @Override
    public List<PrinterInfo> discover() throws PrinterException {
        if (usbManager == null) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "USBManager is not available");
        }

        List<PrinterInfo> devices = new ArrayList<>();
        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (isPrintableUsbDevice(device)) {
                devices.add(toPrinterInfo(device));
            }
        }
        return devices;
    }

    private PrinterInfo toPrinterInfo(UsbDevice device) {
        String name = device.getProductName() != null ? device.getProductName()
                : device.getManufacturerName() != null ? device.getManufacturerName()
                : device.getDeviceName();
        return new PrinterInfo(null, ConnectionType.USB, name, device.getManufacturerName(), device.getProductName(),
                device.getVendorId(), device.getProductId(), getSerialNumberSafely(device), null, null, null);
    }

    private String getSerialNumberSafely(UsbDevice device) {
        try {
            return device.getSerialNumber();
        } catch (SecurityException ignored) {
            return null;
        }
    }

    /** Dùng lại ở UsbConnection để resolve UsbDevice theo vendorId/productId. */
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

- [ ] **Step 4: Cập nhật `discovery/bluetooth/BluetoothPrinterDiscovery.java`**

```java
package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public final class BluetoothPrinterDiscovery implements IPrinterDiscovery {

    @Override
    public List<PrinterInfo> discover() throws PrinterException {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "No bluetooth adapter available");
        }
        if (!adapter.isEnabled()) {
            throw new PrinterException(PrinterErrorCode.DISCOVERY_FAILED, "Bluetooth is not enabled");
        }

        List<PrinterInfo> devices = new ArrayList<>();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        for (BluetoothDevice device : bonded) {
            devices.add(new PrinterInfo(null, ConnectionType.BLUETOOTH, device.getName(), null, null, null, null, null, device.getAddress(), null, null));
        }
        return devices;
    }
}
```

- [ ] **Step 5: Tạo `printer/PrinterManager.java`**

```java
package com.ndtcorepos.thermalprinter.printer;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.detector.BluetoothCapabilityDetector;
import com.ndtcorepos.thermalprinter.detector.CapabilityDetector;
import com.ndtcorepos.thermalprinter.detector.NetCapabilityDetector;
import com.ndtcorepos.thermalprinter.detector.UsbCapabilityDetector;
import com.ndtcorepos.thermalprinter.device.BluetoothPrinterDevice;
import com.ndtcorepos.thermalprinter.device.NetPrinterDevice;
import com.ndtcorepos.thermalprinter.device.UsbPrinterDevice;
import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.bluetooth.BluetoothPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.queue.PrintJob;
import com.ndtcorepos.thermalprinter.queue.PrintJobResult;
import com.ndtcorepos.thermalprinter.queue.PrinterQueueManager;
import com.ndtcorepos.thermalprinter.queue.QueueStatus;
import com.ndtcorepos.thermalprinter.transport.bluetooth.BluetoothConnection;
import com.ndtcorepos.thermalprinter.transport.bluetooth.BluetoothWriter;
import com.ndtcorepos.thermalprinter.transport.net.NetConnection;
import com.ndtcorepos.thermalprinter.transport.net.NetWriter;
import com.ndtcorepos.thermalprinter.transport.usb.UsbConnection;
import com.ndtcorepos.thermalprinter.transport.usb.UsbEndpointResolver;
import com.ndtcorepos.thermalprinter.transport.usb.UsbWriter;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Facade RN gọi qua PrinterModule — orchestration cho registry, queue, discovery, detector.
 */
public final class PrinterManager {

    private final ReactApplicationContext context;
    private final UsbPermission usbPermission;
    private final PrinterRegistry registry = new PrinterRegistry();
    private final PrinterQueueManager queueManager = new PrinterQueueManager(registry);
    private final Map<ConnectionType, IPrinterDiscovery> discoveries = new EnumMap<>(ConnectionType.class);
    private final Map<ConnectionType, CapabilityDetector> detectors = new EnumMap<>(ConnectionType.class);

    public PrinterManager(ReactApplicationContext context, UsbPermission usbPermission) {
        this.context = context;
        this.usbPermission = usbPermission;
        discoveries.put(ConnectionType.USB, new UsbPrinterDiscovery(context));
        discoveries.put(ConnectionType.BLUETOOTH, new BluetoothPrinterDiscovery());
        detectors.put(ConnectionType.USB, new UsbCapabilityDetector());
        detectors.put(ConnectionType.BLUETOOTH, new BluetoothCapabilityDetector());
        detectors.put(ConnectionType.LAN, new NetCapabilityDetector());
    }

    /**
     * Quét thiết bị khả dụng cho 1 loại kết nối.
     *
     * @param type loại kết nối cần quét
     * @return danh sách printer tìm thấy — rỗng nếu không có discovery cho loại này (LAN)
     * @throws PrinterException DISCOVERY_FAILED nếu hệ thống USB/Bluetooth không sẵn sàng
     */
    public List<PrinterInfo> discover(ConnectionType type) throws PrinterException {
        IPrinterDiscovery discovery = discoveries.get(type);
        return discovery == null ? List.of() : discovery.discover();
    }

    /**
     * Kết nối tới printer theo printerId (JS truyền vào) + info.
     *
     * @param printerId khoá đăng ký trong Registry
     * @param info thông tin kết nối
     */
    public CompletableFuture<PrinterResult> connect(String printerId, PrinterInfo info) {
        PrinterDevice device = registry.get(printerId);
        if (device == null) {
            device = createDevice(info);
            registry.put(printerId, device);
        }
        return device.connect();
    }

    private PrinterDevice createDevice(PrinterInfo info) {
        return switch (info.connectionType()) {
            case USB -> {
                UsbEndpointResolver resolver = new UsbEndpointResolver();
                UsbConnection connection = new UsbConnection(context, usbPermission, resolver, info.vendorId(), info.productId());
                yield new UsbPrinterDevice(info, connection, new UsbWriter(connection, resolver));
            }
            case BLUETOOTH -> {
                BluetoothConnection connection = new BluetoothConnection(info.bluetoothAddress());
                yield new BluetoothPrinterDevice(info, connection, new BluetoothWriter(connection));
            }
            case LAN -> {
                NetConnection connection = new NetConnection(info.host(), info.port());
                yield new NetPrinterDevice(info, connection, new NetWriter(connection));
            }
        };
    }

    /**
     * Kết nối lại 1 printer đã có trong Registry.
     *
     * @param printerId id cần kết nối lại
     */
    public CompletableFuture<PrinterResult> reconnect(String printerId) {
        PrinterDevice device = registry.get(printerId);
        if (device == null) {
            return CompletableFuture.failedFuture(new PrinterException(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId));
        }
        return device.connect();
    }

    /**
     * Đóng kết nối tới 1 printer.
     *
     * @param printerId id cần ngắt kết nối
     */
    public CompletableFuture<PrinterResult> disconnect(String printerId) {
        PrinterDevice device = registry.get(printerId);
        if (device == null) {
            return CompletableFuture.failedFuture(new PrinterException(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId));
        }
        return device.disconnect();
    }

    /**
     * Metadata của 1 printer đã đăng ký.
     *
     * @param printerId id cần tra cứu
     * @return metadata tương ứng, null nếu không tìm thấy
     */
    public PrinterInfo getInfo(String printerId) {
        PrinterDevice device = registry.get(printerId);
        return device == null ? null : device.getInfo();
    }

    /**
     * Capability đã detect cho 1 printer.
     *
     * @param printerId id cần tra cứu
     * @return capability tương ứng, null nếu không tìm thấy
     */
    public PrinterCapabilities getCapabilities(String printerId) {
        PrinterDevice device = registry.get(printerId);
        if (device == null) {
            return null;
        }
        CapabilityDetector detector = detectors.get(device.getInfo().connectionType());
        return detector == null ? null : detector.detect(device.getInfo());
    }

    /**
     * Trạng thái kết nối sống hiện tại của printer.
     *
     * @param printerId id cần tra cứu
     * @return trạng thái hiện tại, null nếu printerId không có trong Registry
     */
    public PrinterState getConnectionState(String printerId) {
        PrinterDevice device = registry.get(printerId);
        return device == null ? null : device.getState();
    }

    /**
     * Đưa 1 lệnh ghi vào hàng đợi FIFO của printer này.
     *
     * @param printerId printer đích
     * @param data dữ liệu cần ghi
     */
    public CompletableFuture<PrintJobResult> write(String printerId, byte[] data) {
        PrintJob job = new PrintJob(UUID.randomUUID().toString(), printerId, data, System.currentTimeMillis());
        return queueManager.getOrCreate(printerId).enqueue(job);
    }

    /**
     * Huỷ 1 job còn PENDING trong hàng đợi.
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công, false nếu job không tồn tại/đã chạy
     */
    public boolean cancelJob(String jobId) {
        return queueManager.cancel(jobId);
    }

    /**
     * Trạng thái hàng đợi hiện tại của 1 printer.
     *
     * @param printerId id cần tra cứu
     */
    public QueueStatus getQueueStatus(String printerId) {
        var queue = queueManager.getIfExists(printerId);
        return queue == null ? new QueueStatus(0, null) : queue.status();
    }

    /**
     * Đóng tất cả kết nối và tắt mọi executor — gọi khi RN module bị huỷ.
     */
    public void shutdown() {
        for (PrinterDevice device : registry.getAll()) {
            device.disconnect();
        }
        queueManager.shutdownAll();
    }
}
```

- [ ] **Step 6: Tạo `module/PrinterModule.java`**

```java
package com.ndtcorepos.thermalprinter.module;

import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;
import com.ndtcorepos.thermalprinter.printer.PrinterManager;
import com.ndtcorepos.thermalprinter.printer.PrinterState;
import com.ndtcorepos.thermalprinter.queue.QueueStatus;

import java.util.List;

/**
 * RN bridge duy nhất cho printer — Promise boundary, sinh printerId cho printer mới.
 */
public final class PrinterModule extends ReactContextBaseJavaModule {

    private final PrinterManager printerManager;
    private final UsbPermission usbPermission;
    private boolean usbPermissionRegistered = false;

    public PrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.usbPermission = new UsbPermission(reactContext);
        this.printerManager = new PrinterManager(reactContext, usbPermission);
    }

    @Override
    public String getName() {
        return "ThermalPrinterModule";
    }

    /**
     * Liệt kê thiết bị khả dụng cho 1 loại kết nối.
     *
     * @param type loại kết nối ("usb"/"bluetooth"/"lan")
     * @param promise promise nhận danh sách PrinterInfo
     */
    @ReactMethod
    public void discoverPrinters(String type, Promise promise) {
        try {
            ConnectionType connectionType = ConnectionType.fromWireValue(type);
            if (connectionType == ConnectionType.USB) {
                ensureUsbPermissionRegistered();
            }
            List<PrinterInfo> devices = printerManager.discover(connectionType);
            WritableArray result = Arguments.createArray();
            for (PrinterInfo info : devices) {
                result.pushMap(toWritableMap(info));
            }
            promise.resolve(result);
        } catch (PrinterException e) {
            PrinterErrorResult.from(e).rejectTo(promise);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        }
    }

    private void ensureUsbPermissionRegistered() {
        if (!usbPermissionRegistered) {
            usbPermission.register();
            usbPermissionRegistered = true;
        }
    }

    /**
     * Kết nối tới printer theo thông tin truyền vào.
     *
     * <p>Idempotent theo printerId — gọi lại khi đã CONNECTED không mở
     * thêm kết nối mới.</p>
     *
     * @param printer thông tin kết nối (printerId bắt buộc, type + field theo loại)
     * @param promise promise nhận kết quả kết nối
     */
    @ReactMethod
    public void connect(ReadableMap printer, Promise promise) {
        try {
            String printerId = printer.getString("printerId");
            ConnectionType type = ConnectionType.fromWireValue(printer.getString("type"));
            if (type == ConnectionType.USB) {
                ensureUsbPermissionRegistered();
            }
            PrinterInfo info = toPrinterInfo(printerId, type, printer);
            printerManager.connect(printerId, info).whenComplete((result, error) -> {
                if (error != null) {
                    rejectAsync(error, promise);
                } else {
                    promise.resolve(Arguments.createMap());
                }
            });
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        }
    }

    private PrinterInfo toPrinterInfo(String printerId, ConnectionType type, ReadableMap map) {
        return switch (type) {
            case USB -> new PrinterInfo(printerId, type, null, null, null, map.getInt("vendorId"), map.getInt("productId"), null, null, null, null);
            case BLUETOOTH -> new PrinterInfo(printerId, type, null, null, null, null, null, null, map.getString("address"), null, null);
            case LAN -> new PrinterInfo(printerId, type, null, null, null, null, null, null, null, map.getString("host"), map.getInt("port"));
        };
    }

    /**
     * Kết nối lại 1 printer đã có trong Registry.
     *
     * @param printerId id printer cần kết nối lại
     * @param promise promise nhận kết quả kết nối
     */
    @ReactMethod
    public void reconnect(String printerId, Promise promise) {
        printerManager.reconnect(printerId).whenComplete((result, error) -> {
            if (error != null) {
                rejectAsync(error, promise);
            } else {
                promise.resolve(null);
            }
        });
    }

    /**
     * Đóng kết nối tới printer.
     *
     * @param printerId id printer cần ngắt kết nối
     * @param promise promise nhận kết quả ngắt kết nối
     */
    @ReactMethod
    public void disconnect(String printerId, Promise promise) {
        printerManager.disconnect(printerId).whenComplete((result, error) -> {
            if (error != null) {
                rejectAsync(error, promise);
            } else {
                promise.resolve(null);
            }
        });
    }

    /**
     * Giải mã Base64 rồi ghi raw bytes tới printer — kết nối được giữ
     * nguyên, chỉ đóng khi gọi disconnect().
     *
     * @param printerId id printer đích
     * @param base64Data dữ liệu đã encode Base64
     * @param promise promise nhận kết quả ghi
     */
    @ReactMethod
    public void writeByBase64(String printerId, String base64Data, Promise promise) {
        byte[] bytes;
        try {
            bytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.INVALID_ARGUMENT, "Invalid base64 data: " + e.getMessage()).rejectTo(promise);
            return;
        }
        if (bytes.length == 0) {
            new PrinterErrorResult(PrinterErrorCode.INVALID_ARGUMENT, "Print data must not be empty").rejectTo(promise);
            return;
        }
        printerManager.write(printerId, bytes).thenAccept(result -> {
            if (result.success()) {
                promise.resolve("Print SuccessFully");
            } else {
                new PrinterErrorResult(result.errorCode(), result.message()).rejectTo(promise);
            }
        });
    }

    /**
     * Lấy metadata của 1 printer đã đăng ký.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận metadata
     */
    @ReactMethod
    public void getPrinterInfo(String printerId, Promise promise) {
        PrinterInfo info = printerManager.getInfo(printerId);
        if (info == null) {
            new PrinterErrorResult(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId).rejectTo(promise);
            return;
        }
        promise.resolve(toWritableMap(info));
    }

    /**
     * Lấy capability native đã detect cho 1 printer.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận capability
     */
    @ReactMethod
    public void getPrinterCapabilities(String printerId, Promise promise) {
        PrinterCapabilities capabilities = printerManager.getCapabilities(printerId);
        if (capabilities == null) {
            new PrinterErrorResult(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId).rejectTo(promise);
            return;
        }
        WritableMap map = Arguments.createMap();
        map.putString("rawWrite", capabilities.rawWrite().name());
        map.putString("paperStatus", capabilities.paperStatus().name());
        map.putString("coverStatus", capabilities.coverStatus().name());
        map.putString("printerStatus", capabilities.printerStatus().name());
        promise.resolve(map);
    }

    /**
     * Lấy trạng thái kết nối sống hiện tại của 1 printer.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận trạng thái hiện tại (tên PrinterState)
     */
    @ReactMethod
    public void getConnectionState(String printerId, Promise promise) {
        PrinterState state = printerManager.getConnectionState(printerId);
        if (state == null) {
            new PrinterErrorResult(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId).rejectTo(promise);
            return;
        }
        promise.resolve(state.name());
    }

    /**
     * Huỷ 1 job còn đang chờ trong hàng đợi.
     *
     * @param jobId id job cần huỷ
     * @param promise promise nhận kết quả huỷ
     */
    @ReactMethod
    public void cancelPrintJob(String jobId, Promise promise) {
        promise.resolve(printerManager.cancelJob(jobId));
    }

    /**
     * Lấy trạng thái hàng đợi hiện tại của 1 printer.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận trạng thái hàng đợi
     */
    @ReactMethod
    public void getQueueStatus(String printerId, Promise promise) {
        QueueStatus status = printerManager.getQueueStatus(printerId);
        WritableMap map = Arguments.createMap();
        map.putInt("pendingCount", status.pendingCount());
        if (status.runningJobId() == null) {
            map.putNull("runningJobId");
        } else {
            map.putString("runningJobId", status.runningJobId());
        }
        promise.resolve(map);
    }

    private WritableMap toWritableMap(PrinterInfo info) {
        WritableMap map = Arguments.createMap();
        map.putString("printerId", info.printerId());
        map.putString("type", info.connectionType().name().toLowerCase());
        putStringOrNull(map, "name", info.name());
        putStringOrNull(map, "manufacturerName", info.manufacturerName());
        putStringOrNull(map, "productName", info.productName());
        putIntOrNull(map, "vendorId", info.vendorId());
        putIntOrNull(map, "productId", info.productId());
        putStringOrNull(map, "serialNumber", info.serialNumber());
        putStringOrNull(map, "address", info.bluetoothAddress());
        putStringOrNull(map, "host", info.host());
        putIntOrNull(map, "port", info.port());
        return map;
    }

    private void putStringOrNull(WritableMap map, String key, String value) {
        if (value == null) {
            map.putNull(key);
        } else {
            map.putString(key, value);
        }
    }

    private void putIntOrNull(WritableMap map, String key, Integer value) {
        if (value == null) {
            map.putNull(key);
        } else {
            map.putInt(key, value);
        }
    }

    private void rejectAsync(Throwable error, Promise promise) {
        Throwable cause = error.getCause() != null ? error.getCause() : error;
        if (cause instanceof PrinterException printerException) {
            PrinterErrorResult.from(printerException).rejectTo(promise);
        } else {
            new PrinterErrorResult(PrinterErrorCode.UNKNOWN_ERROR, cause.getMessage()).rejectTo(promise);
        }
    }

    @Override
    public void invalidate() {
        super.invalidate();
        printerManager.shutdown();
    }
}
```

- [ ] **Step 7: Cập nhật `module/ThermalPrinterPackage.java`** — chỉ đổi dòng khởi tạo module

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
        return Arrays.asList(new NativeModule[] { new PrinterModule(reactContext) });
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
```

- [ ] **Step 8: Xoá 2 wrapper class discovery cũ**

```bash
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/usb/UsbPrinterDevice.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDevice.java
```

- [ ] **Step 9: Xoá model/transport/application/module cũ**

```bash
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterConnection.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/model/IPrinterDevice.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/model/PrinterData.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/IPrinterTransport.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbPrinterTransport.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothPrinterTransport.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/network/NetworkPrinterTransport.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/application/PrinterService.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/application/PrinterServiceFactory.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java
```

- [ ] **Step 10: Verify compile (toàn bộ app)**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat :app:compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL. Nếu lỗi "cannot find symbol" ở file nào khác ngoài danh sách trên, đó là consumer còn sót của code đã xoá — cần rà lại (`grep -rn "model.PrinterConnection\|model.IPrinterDevice\|model.PrinterData\|IPrinterTransport\|PrinterService\b\|PrinterServiceFactory\|ThermalPrinterModule\b" android/app/src/main/java` để tìm).

- [ ] **Step 11: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorCode.java android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/ android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterManager.java android/app/src/main/java/com/ndtcorepos/thermalprinter/module/
git commit -m "refactor: cut over to PrinterManager/PrinterModule, delete legacy classes"
```

---

## Task 12: JS — `PrinterNativeModule.ts` viết lại phẳng theo `printerId`

**Files:**
- Modify: `src/features/printer/adapters/native/PrinterNativeModule.ts`

**Interfaces:**
- Produces: `ThermalPrinterModule` object (`discoverPrinters`/`connect`/`reconnect`/`disconnect`/`writeByBase64`/`getPrinterInfo`/`getPrinterCapabilities`/`getConnectionState`/`cancelPrintJob`/`getQueueStatus`), types `PrinterInfoDto`, `PrinterCapabilitiesDto`, `QueueStatusDto`, `ConnectRequest` (union `UsbConnectRequest`/`BluetoothConnectRequest`/`LanConnectRequest`). Xoá hoàn toàn `USBPrinter`/`BLEPrinter`/`NetPrinter`/`ThermalPrinterAdapter`/`ensureNativeInitialized`/`ensureUsbInitialized`/`printRawDataUsb/Bluetooth/Lan`/`IUSBPrinter`/`IBLEPrinter`/`INetPrinter`.
- Consumes bởi: Task 13 (`NativeAdapter.ts`, `UsbTransport.ts`, `useConnectionSetup.ts`).

- [ ] **Step 1: Viết lại toàn bộ `PrinterNativeModule.ts`**

```ts
import { NativeModules } from 'react-native';
import type { ConnectionType } from '../../models/printer/PrinterDevice';

const ThermalPrinterModuleNative = NativeModules.ThermalPrinterModule;

/** Metadata 1 printer trả về từ native (discoverPrinters/getPrinterInfo). */
export interface PrinterInfoDto {
  printerId: string;
  type: 'usb' | 'bluetooth' | 'lan';
  name: string | null;
  manufacturerName: string | null;
  productName: string | null;
  vendorId: number | null;
  productId: number | null;
  serialNumber: string | null;
  address: string | null;
  host: string | null;
  port: number | null;
}

type CapabilityStateDto = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

/** Capability native đã detect cho 1 printer — xem PrinterCapabilities (native). */
export interface PrinterCapabilitiesDto {
  rawWrite: CapabilityStateDto;
  paperStatus: CapabilityStateDto;
  coverStatus: CapabilityStateDto;
  printerStatus: CapabilityStateDto;
}

/** Trạng thái hàng đợi 1 printer — xem QueueStatus (native). */
export interface QueueStatusDto {
  pendingCount: number;
  runningJobId: string | null;
}

export type UsbConnectRequest = { printerId: string; type: 'usb'; vendorId: number; productId: number };
export type BluetoothConnectRequest = { printerId: string; type: 'bluetooth'; address: string };
export type LanConnectRequest = { printerId: string; type: 'lan'; host: string; port: number };
export type ConnectRequest = UsbConnectRequest | BluetoothConnectRequest | LanConnectRequest;

/**
 * Lớp JS của native module `ThermalPrinterModule`
 * (`com.ndtcorepos.thermalprinter.module.PrinterModule`, code ở
 * `android/app/src/main/java/com/ndtcorepos/thermalprinter/`) — chỉ Android.
 * Mọi lệnh địa chỉ theo `printerId` (không còn theo `connectionType` như bản
 * cũ) — 1 printerId ứng đúng 1 device đã connect, cho phép nhiều printer
 * cùng loại kết nối song song. Không có `init()` — permission USB được xử
 * lý ngầm trong `discoverPrinters`/`connect`.
 */
export const ThermalPrinterModule = {
  discoverPrinters: (type: ConnectionType): Promise<PrinterInfoDto[]> => ThermalPrinterModuleNative.discoverPrinters(type),

  connect: (request: ConnectRequest): Promise<void> => ThermalPrinterModuleNative.connect(request),

  reconnect: (printerId: string): Promise<void> => ThermalPrinterModuleNative.reconnect(printerId),

  disconnect: (printerId: string): Promise<void> => ThermalPrinterModuleNative.disconnect(printerId),

  writeByBase64: (printerId: string, base64Data: string): Promise<string> => ThermalPrinterModuleNative.writeByBase64(printerId, base64Data),

  getPrinterInfo: (printerId: string): Promise<PrinterInfoDto> => ThermalPrinterModuleNative.getPrinterInfo(printerId),

  getPrinterCapabilities: (printerId: string): Promise<PrinterCapabilitiesDto> => ThermalPrinterModuleNative.getPrinterCapabilities(printerId),

  getConnectionState: (printerId: string): Promise<string> => ThermalPrinterModuleNative.getConnectionState(printerId),

  cancelPrintJob: (jobId: string): Promise<boolean> => ThermalPrinterModuleNative.cancelPrintJob(jobId),

  getQueueStatus: (printerId: string): Promise<QueueStatusDto> => ThermalPrinterModuleNative.getQueueStatus(printerId),
};
```

- [ ] **Step 2: Type-check (sẽ còn lỗi ở các file consumer — chưa sửa tới, dự kiến)**

Run: `npm run type-check`
Expected: lỗi tại `UsbTransport.ts`, `NativeAdapter.ts`, `useConnectionSetup.ts` (import `USBPrinter`/`ensureUsbInitialized`/`printRawDataUsb` không còn tồn tại) — đúng dự kiến, sửa ở Task 13-14.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/adapters/native/PrinterNativeModule.ts
git commit -m "refactor: rewrite PrinterNativeModule.ts as flat printerId-addressed API"
```

---

## Task 13: JS — `IPrinterAdapter.ts` thêm `printerId`, bỏ `keepConnection`

**Files:**
- Modify: `src/features/printer/adapters/IPrinterAdapter.ts`
- Modify: `src/features/printer/models/printer/PrinterDevice.ts`

**Interfaces:**
- Consumes: không đổi.
- Produces: `PrinterConnectTarget` có thêm field `printerId: string`; `PrinterPrintTextOptions` bỏ `keepConnection`; `UsbRawDevice` đổi field sang camelCase (`vendorId`/`productId`), bỏ `version`/`interfaces`/`hasBulkInEndpoint`/`hasBulkOutEndpoint` (không còn consumer nào đọc — xem Task tổng hợp đã rà soát).

- [ ] **Step 1: Sửa `models/printer/PrinterDevice.ts`** — cập nhật `UsbRawDevice`

```ts
/**
 * Hình dạng `PrinterDevice.rawDevice` khi `connectionType === 'usb'` — khớp
 * `PrinterInfoDto` từ native (`vendorId`/`productId` luôn có; `serialNumber`
 * cần quyền USB Android 10+, có thể null lúc scan lần đầu).
 */
export interface UsbRawDevice {
  vendorId: number;
  productId: number;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
}
```

(Thay thế nguyên khối `export interface UsbRawDevice { ... }` cũ — các field khác trong file `PrinterDevice.ts` không đổi.)

- [ ] **Step 2: Sửa `IPrinterAdapter.ts`** — thêm `printerId`, bỏ `keepConnection`, cập nhật `toConnectTarget`

```ts
/**
 * Mục tiêu kết nối 1 máy in — phẳng theo `connectionType`, driver dựng từ
 * `Printer` (xem `toConnectTarget`). Adapter chỉ đọc field khớp `connectionType`.
 */
export interface PrinterConnectTarget {
  printerId: string;
  connectionType: ConnectionType;
  lan?: { ip: string; port: number };
  bluetooth?: { deviceId: string };
  usb?: { vendorId: number; productId: number };
}

/** Tuỳ chọn khi để adapter tự encode ESC/POS (`printText`). */
export interface PrinterPrintTextOptions {
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}
```

(Xoá field `keepConnection: boolean;` khỏi `PrinterPrintTextOptions`, thêm `printerId: string;` vào đầu `PrinterConnectTarget` — giữ nguyên phần còn lại của interface.)

Cập nhật `toConnectTarget`:

```ts
export const toConnectTarget = (printer: Printer): PrinterConnectTarget => {
  if (printer.connection.type === 'lan') {
    if (!printer.connection.lan) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
    return { printerId: printer.id, connectionType: printer.connection.type, lan: { ip: printer.connection.lan.ip, port: printer.connection.lan.port } };
  }
  if (printer.connection.type === 'bluetooth') {
    if (!printer.connection.device) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
    return { printerId: printer.id, connectionType: printer.connection.type, bluetooth: { deviceId: printer.connection.device.deviceId } };
  }
  const raw = printer.connection.device?.rawDevice as unknown as UsbRawDevice | undefined;
  if (!raw) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
  return { printerId: printer.id, connectionType: printer.connection.type, usb: { vendorId: Number(raw.vendorId), productId: Number(raw.productId) } };
};
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: lỗi còn lại ở `NativeAdapter.ts`/`LibraryAdapter.ts` (thiếu field `printerId` khi build `PrinterConnectTarget` trong test, hoặc chưa dùng `printerId`) — dự kiến, sửa ở Task 14. `LibraryAdapter.ts`/`VendorAdapter.ts` không bắt buộc dùng `printerId` (field thêm, không optional nhưng TypeScript sẽ báo thiếu ở nơi TẠO object — chỉ `toConnectTarget` tạo `PrinterConnectTarget`, nên không ảnh hưởng file khác).

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/adapters/IPrinterAdapter.ts src/features/printer/models/printer/PrinterDevice.ts
git commit -m "refactor: add printerId to PrinterConnectTarget, drop keepConnection"
```

---

## Task 14: JS — `NativeAdapter.ts` + `UsbTransport.ts` theo API mới

**Files:**
- Modify: `src/features/printer/adapters/native/NativeAdapter.ts`
- Modify: `src/features/printer/transports/UsbTransport.ts`

**Interfaces:**
- Consumes: `ThermalPrinterModule` (Task 12), `PrinterConnectTarget`/`PrinterPrintTextOptions` (Task 13).
- Produces: `NativeAdapter` giữ nguyên `IPrinterAdapter` contract; `UsbTransport.connect(printerId, vendorId, productId)` (thêm tham số `printerId`).

- [ ] **Step 1: Viết lại `UsbTransport.ts`**

```ts
import { ThermalPrinterModule } from '../adapters/native/PrinterNativeModule';
import { Buffer } from 'buffer';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';
import { LoggerService } from '../../../services/LoggerService';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Android `UsbDeviceConnection.bulkTransfer(ep, buf, len, timeout)` fail (trả
 * `-1` ngay, không phải timeout) khi `len` vượt giới hạn 1 transfer (~16KB tuỳ
 * kernel). Print bill/tem vài KB đi 1 lần bình thường; font `DOWNLOAD` (~145KB)
 * hoặc bitmap dài phải chia.
 *
 * ĐÃ THỬ chunk nhỏ hơn (4000, không bội số 512) + nghỉ giữa các chunk để né
 * `USB_DEVICE_DETACHED` khi cài font TrueType (~145KB) — KHÔNG có tác dụng: máy
 * in vẫn rớt khỏi bus sau ~16-20KB tổng dữ liệu bất kể chia chunk kiểu gì hay
 * nghỉ bao lâu. Kết luận: giới hạn buffer `DOWNLOAD` của FIRMWARE máy in
 * (~16-20KB), không phải vấn đề timing/kích thước chunk ở tầng USB — đừng
 * thử lại hướng này. Giữ nguyên 16KB cho các lệnh ghi khác (bitmap/bill) vốn
 * hoạt động bình thường.
 */
const USB_WRITE_CHUNK_BYTES = 16 * 1024;

/**
 * Transport TSPL-qua-USB, dùng chung native module `ThermalPrinterModule` với
 * `EscPosDriver`. Không có khả năng đọc phản hồi (chỉ có bulk-OUT endpoint ở
 * tầng native), nên không có `readOnce()` như `LanTransport`/`BluetoothTransport`
 * — `TsplDriver.identify()` đã tự loại USB khỏi việc dò `~!T` bằng cách kiểm
 * tra `'readOnce' in transport`.
 */
export class UsbTransport {
  private printerId?: string;

  async connect(printerId: string, vendorId: number, productId: number): Promise<void> {
    try {
      await ThermalPrinterModule.connect({ printerId, type: 'usb', vendorId, productId });
      this.printerId = printerId;
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: errorMessage(error) });
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.printerId) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'UsbTransport chưa connect' });
    }
    const totalChunks = Math.max(1, Math.ceil(bytes.length / USB_WRITE_CHUNK_BYTES));
    LoggerService.debug('UsbTransport.write', { totalBytes: bytes.length, totalChunks, chunkSize: USB_WRITE_CHUNK_BYTES });
    let index = 0;
    try {
      for (let offset = 0; offset < bytes.length; offset += USB_WRITE_CHUNK_BYTES) {
        const chunk = bytes.subarray(offset, offset + USB_WRITE_CHUNK_BYTES);
        index += 1;
        await ThermalPrinterModule.writeByBase64(this.printerId, Buffer.from(chunk).toString('base64'));
        LoggerService.debug(`UsbTransport.write: chunk ${index}/${totalChunks} OK`, { bytes: chunk.length });
      }
    } catch (error) {
      LoggerService.warning(`UsbTransport.write: chunk ${index}/${totalChunks} FAIL`, { error: errorMessage(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: errorMessage(error) });
    }
  }

  async close(): Promise<void> {
    if (!this.printerId) return;
    try {
      await ThermalPrinterModule.disconnect(this.printerId);
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: errorMessage(error) });
    }
  }
}
```

- [ ] **Step 2: Viết lại `NativeAdapter.ts`**

```ts
import { Buffer } from 'buffer';
import { NativeModules, Platform } from 'react-native';
import type { IPrinterAdapter, PrinterConnectTarget, PrinterPrintTextOptions } from '../IPrinterAdapter';
import { ConnectionType } from '../../models/printer/PrinterDevice';
import type { PrinterDevice } from '../../models/printer/PrinterDevice';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { UsbTransport } from '../../transports/UsbTransport';
import { ThermalPrinterModule } from './PrinterNativeModule';
import * as EPToolkit from './utils/EPToolkit';

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

const textTo64Base64 = (text: string, opts: PrinterPrintTextOptions): string =>
  EPToolkit.exchange_text(text, opts).toString('base64').replace('G0AcJhxD/xsy', '');

/**
 * `IPrinterAdapter` chạy qua native module tự viết (`PrinterNativeModule` →
 * `ThermalPrinterModule`, code Java ở `com.ndtcorepos.thermalprinter`).
 *
 * Giới hạn: native module KHÔNG expose `read` → `read()` luôn trả `null`. USB
 * còn dùng `UsbTransport` (chunk 16KB) cho `write`; `printText` USB vẫn ghi
 * thẳng qua `writeByBase64` không chunk (bill ESC/POS hiếm khi vượt 16KB —
 * giữ nguyên hành vi bản cũ).
 */
export class NativeAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;
  readonly canRead = false;

  private connectionType?: ConnectionType;
  private printerId?: string;
  private usb?: UsbTransport;

  async listDevices(connectionType: ConnectionType): Promise<PrinterDevice[]> {
    if (connectionType === ConnectionType.lan) return [];
    const devices = await ThermalPrinterModule.discoverPrinters(connectionType);
    return devices.map((d) => ({
      deviceId: connectionType === ConnectionType.bluetooth ? (d.address ?? '') : `${d.vendorId}:${d.productId}`,
      displayName: d.name ?? '',
      rawDevice: d as unknown as Record<string, unknown>,
    }));
  }

  async connect(target: PrinterConnectTarget): Promise<void> {
    this.connectionType = target.connectionType;
    this.printerId = target.printerId;
    if (target.connectionType === ConnectionType.usb) {
      if (!target.usb) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
      this.usb = new UsbTransport();
      await this.usb.connect(target.printerId, target.usb.vendorId, target.usb.productId);
      return;
    }
    if (target.connectionType === ConnectionType.bluetooth) {
      if (!target.bluetooth) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
      await ThermalPrinterModule.connect({ printerId: target.printerId, type: 'bluetooth', address: target.bluetooth.deviceId });
      return;
    }
    if (!target.lan) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
    await ThermalPrinterModule.connect({ printerId: target.printerId, type: 'lan', host: target.lan.ip, port: target.lan.port });
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (this.connectionType === ConnectionType.usb) {
      if (!this.usb) throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in USB chưa kết nối' });
      return this.usb.write(bytes);
    }
    if (!this.printerId) throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
    const base64 = Buffer.from(bytes).toString('base64');
    await ThermalPrinterModule.writeByBase64(this.printerId, base64);
  }

  async printText(text: string, options: PrinterPrintTextOptions): Promise<void> {
    if (!this.connectionType) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
    }
    if (Platform.OS === 'ios' && this.connectionType !== ConnectionType.usb) {
      // Native iOS chưa implement (module khác, ngoài phạm vi Android-only) —
      // giữ nguyên lệnh gọi native cũ (RNBLEPrinter/RNNetPrinter), không liên
      // quan tới printerId của kiến trúc Android mới.
      const legacyModule = this.connectionType === ConnectionType.bluetooth ? NativeModules.RNBLEPrinter : NativeModules.RNNetPrinter;
      const processed = textPreprocessingIOS(text);
      return new Promise((resolve, reject) => {
        legacyModule.printRawData(processed.text, processed.opts, () => resolve(), (error: Error) => reject(error));
      });
    }
    if (!this.printerId) throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
    await ThermalPrinterModule.writeByBase64(this.printerId, textTo64Base64(text, options));
  }

  /** Native module chỉ có bulk-OUT — không đọc được phản hồi. */
  async read(_timeoutMs: number): Promise<Uint8Array | null> {
    return null;
  }

  async disconnect(): Promise<void> {
    if (this.connectionType === ConnectionType.usb) {
      await this.usb?.close();
      return;
    }
    if (!this.printerId) return;
    await ThermalPrinterModule.disconnect(this.printerId);
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: lỗi còn lại chỉ ở `useConnectionSetup.ts` (import `USBPrinter` không còn) — sửa ở Task 15.

- [ ] **Step 4: Commit**

```bash
git add src/features/printer/adapters/native/NativeAdapter.ts src/features/printer/transports/UsbTransport.ts
git commit -m "refactor: NativeAdapter/UsbTransport use printerId-addressed bridge"
```

---

## Task 15: JS — `useConnectionSetup.ts` cập nhật field USB camelCase

**Files:**
- Modify: `src/features/printer/hooks/addPrinter/useConnectionSetup.ts`

**Interfaces:**
- Consumes: `ThermalPrinterModule.discoverPrinters` (Task 12), `UsbRawDevice` (Task 13).

- [ ] **Step 1: Sửa import + `refreshUsbSerial`**

Đổi:
```ts
import { USBPrinter } from '../../adapters/native/PrinterNativeModule';
```
thành:
```ts
import { ThermalPrinterModule } from '../../adapters/native/PrinterNativeModule';
```

Đổi thân `refreshUsbSerial`:
```ts
  const refreshUsbSerial = async (): Promise<void> => {
    if (connectionType !== ConnectionType.usb || !selectedDevice) return;
    const raw = selectedDevice.rawDevice as unknown as UsbRawDevice;
    if (raw.serialNumber) return;
    const devices = await ThermalPrinterModule.discoverPrinters(ConnectionType.usb).catch(() => []);
    const rich = devices.find((d) => d.vendorId === Number(raw.vendorId) && d.productId === Number(raw.productId));
    if (!rich?.serialNumber) return;
    setSelectedDevice((prev) => (prev ? { ...prev, rawDevice: { ...prev.rawDevice, serialNumber: rich.serialNumber } } : prev));
  };
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi trong toàn bộ `src/features/printer/` liên quan tới API cũ (`USBPrinter`/`BLEPrinter`/`NetPrinter`/`ensureNativeInitialized`/`ensureUsbInitialized`/`printRawDataUsb/Bluetooth/Lan`/`keepConnection`/`vendor_id`/`product_id` không còn xuất hiện trong code sản phẩm — có thể còn trong test, xử lý ở Task 16).

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/hooks/addPrinter/useConnectionSetup.ts
git commit -m "refactor: useConnectionSetup reads camelCase vendorId/productId"
```

---

## Task 16: JS — cập nhật test theo API mới, `npm run verify` xanh

**Files:**
- Modify: `jest.setup.js`
- Modify: `src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts`
- Modify: `src/features/printer/adapters/native/__tests__/NativeAdapter.test.ts`
- Modify: `src/features/printer/transports/__tests__/UsbTransport.test.ts`
- Modify: `src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts`
- Modify: `src/features/printer/adapters/testing/MockPrinterAdapter.ts` (nếu còn tham chiếu `ensureUsbInitialized`)

**Interfaces:**
- Consumes: `ThermalPrinterModule` (Task 12), `PrinterConnectTarget` có `printerId` (Task 13).

- [ ] **Step 1: Sửa mock toàn cục trong `jest.setup.js`** — thay khối `jest.mock('.../PrinterNativeModule', ...)` và khối stub `NativeModules.ThermalPrinterModule`

```js
// Lớp JS của native module RN*Printer (adapters/native/PrinterNativeModule)
// gọi thẳng NativeModules.ThermalPrinterModule, nên bất kỳ test nào
// transitively import EscPosDriver.ts / UsbTransport.ts — kể cả không chạy —
// đều fail nếu không mock ở đây. Test cần kiểm soát chi tiết (EscPosDriver.test.ts,
// UsbTransport.test.ts...) override bằng jest.mock() cục bộ, ưu tiên hơn.
jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    reconnect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('Print SuccessFully'),
    getPrinterInfo: jest.fn().mockResolvedValue(undefined),
    getPrinterCapabilities: jest.fn().mockResolvedValue(undefined),
    getConnectionState: jest.fn().mockResolvedValue('CONNECTED'),
    cancelPrintJob: jest.fn().mockResolvedValue(false),
    getQueueStatus: jest.fn().mockResolvedValue({ pendingCount: 0, runningJobId: null }),
  },
}));

// PrinterNativeModule.test.ts dùng requireActual để test bản THẬT — cần
// NativeModules.ThermalPrinterModule tồn tại vì RN jest preset không có.
{
  const { NativeModules } = require('react-native');
  NativeModules.ThermalPrinterModule = {
    ...NativeModules.ThermalPrinterModule,
    connect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  };
}
```

- [ ] **Step 2: Viết lại `PrinterNativeModule.test.ts`** — file giờ chỉ còn thin wrapper, test verify gọi đúng `NativeModules.ThermalPrinterModule` với đúng tham số

```ts
import { NativeModules } from 'react-native';

const loadReal = () =>
  jest.requireActual('../PrinterNativeModule') as typeof import('../PrinterNativeModule');

const originalThermalPrinterModule = NativeModules.ThermalPrinterModule;

beforeEach(() => {
  NativeModules.ThermalPrinterModule = {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    reconnect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
    getPrinterInfo: jest.fn().mockResolvedValue(undefined),
    getPrinterCapabilities: jest.fn().mockResolvedValue(undefined),
    getConnectionState: jest.fn().mockResolvedValue('CONNECTED'),
    cancelPrintJob: jest.fn().mockResolvedValue(false),
    getQueueStatus: jest.fn().mockResolvedValue({ pendingCount: 0, runningJobId: null }),
  };
});

afterEach(() => {
  NativeModules.ThermalPrinterModule = originalThermalPrinterModule;
  jest.resetModules();
});

describe('ThermalPrinterModule', () => {
  it('discoverPrinters gọi native với đúng type', async () => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.discoverPrinters('usb' as never);
    expect(NativeModules.ThermalPrinterModule.discoverPrinters).toHaveBeenCalledWith('usb');
  });

  it('connect gọi native với đúng request (kèm printerId)', async () => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.connect({ printerId: 'p1', type: 'usb', vendorId: 1234, productId: 5678 });
    expect(NativeModules.ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: 'p1', type: 'usb', vendorId: 1234, productId: 5678 });
  });

  it('disconnect gọi native với đúng printerId', async () => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.disconnect('p1');
    expect(NativeModules.ThermalPrinterModule.disconnect).toHaveBeenCalledWith('p1');
  });

  it('writeByBase64 gọi native với đúng printerId + base64Data', async () => {
    const { ThermalPrinterModule } = loadReal();
    await expect(ThermalPrinterModule.writeByBase64('p1', 'QUI=')).resolves.toBe('ok');
    expect(NativeModules.ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('p1', 'QUI=');
  });
});
```

(Xoá hoàn toàn nội dung cũ của file — không còn `ThermalPrinterAdapter`/`ensureUsbInitialized`/`printRawDataUsb`/`USBPrinter.connectPrinter`/`closeConn` để test, vì các export đó không còn tồn tại.)

- [ ] **Step 3: Sửa `UsbTransport.test.ts`** — đọc file hiện tại trước khi sửa (`Read` tool), áp dụng thay đổi:
  - Mock `ThermalPrinterModule` (từ `PrinterNativeModule`) thay vì `USBPrinter`/`ensureUsbInitialized`/`printRawDataUsb`.
  - `transport.connect('p1', 1234, 5678)` thay vì `transport.connect(1234, 5678)` — thêm `printerId` làm tham số đầu.
  - Assertion cũ `expect(ensureUsbInitialized).toHaveBeenCalled()` → xoá (hàm không còn tồn tại).
  - Assertion cũ kiểm `keepConnection` luôn `true` trong mỗi lệnh gọi `printRawDataUsb` → đổi sang kiểm `ThermalPrinterModule.writeByBase64` được gọi với `('p1', base64Chunk)` (không còn tham số thứ 3).
  - Test chunk 16KB (bulkTransfer limit) giữ nguyên logic, chỉ đổi mock target.

- [ ] **Step 4: Sửa `NativeAdapter.test.ts`** — đọc file hiện tại trước khi sửa, áp dụng thay đổi:
  - Mock `ThermalPrinterModule` (flat) thay vì `USBPrinter`/`BLEPrinter`/`NetPrinter`/`ThermalPrinterAdapter`/`ensureNativeInitialized`.
  - `listDevices('bluetooth')`: mock `ThermalPrinterModule.discoverPrinters` trả `[{ address: 'AA:BB', name: 'BT', ... }]`, assert kết quả map đúng `{ deviceId: 'AA:BB', displayName: 'BT', rawDevice: {...} }` (thay `inner_mac_address`/`device_name` cũ).
  - `listDevices('usb')`: mock trả `[{ vendorId: 1155, productId: 22222, name: 'X', ... }]`, assert `deviceId: '1155:22222'`.
  - `connect({...})`: bổ sung `printerId: 'p1'` vào mọi `PrinterConnectTarget` test fixture, assert `ThermalPrinterModule.connect` được gọi với object có `printerId`.
  - Xoá assertion liên quan `ensureNativeInitialized`.

- [ ] **Step 5: Sửa `EscPosDriver.test.ts`** — đọc file hiện tại trước khi sửa: bỏ `keepConnection: true` khỏi mọi object `PrinterPrintTextOptions`/`ESC_POS_BASE_OPTIONS` kỳ vọng trong `expect.objectContaining(...)`; nếu mock `jest.mock('.../PrinterNativeModule', ...)` cục bộ có `ensureUsbInitialized`/`ensureNativeInitialized`, xoá 2 key đó khỏi object mock trả về.

- [ ] **Step 6: Kiểm tra `MockPrinterAdapter.ts`/`MockPrinterAdapter.test.ts`** — nếu còn export/test `ensureUsbInitialized`, xoá (không còn ý nghĩa với API mới).

- [ ] **Step 7: Chạy toàn bộ verify**

Run: `npm run verify`
Expected: BUILD SUCCESSFUL — 0 lỗi type-check, 0 lỗi lint, tất cả test pass. Nếu còn test fail ở file khác (vd `PrinterSchema.test.ts`, `Printer.test.ts`) do fixture cũ tham chiếu field đã đổi, sửa tương tự (đọc file, đổi field snake_case→camelCase, bỏ `keepConnection`).

- [ ] **Step 8: Commit**

```bash
git add jest.setup.js src/features/printer/adapters/native/__tests__/ src/features/printer/transports/__tests__/UsbTransport.test.ts src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts src/features/printer/adapters/testing/
git commit -m "test: update printer tests for printerId-addressed bridge API"
```

---

## Task 17: Xác minh thủ công trên thiết bị thật (không tự động hoá)

Không có test tự động cho phần cứng thật — bàn giao cho người dùng kiểm tra trên thiết bị Android + máy in thật trước khi merge:

- [ ] Kết nối + in thử qua USB (1 máy in ESC/POS).
- [ ] Kết nối + in thử qua Bluetooth.
- [ ] Kết nối + in thử qua LAN.
- [ ] Cài font TrueType lớn (~145KB) qua USB (TSPL) — xác nhận chunk 16KB vẫn hoạt động đúng như trước (không rớt USB giữa chừng).
- [ ] Thêm 2 máy in USB khác nhau (2 `printerId` khác nhau, cùng `connectionType`), kết nối + in đồng thời — xác nhận không còn giới hạn "1 device active/loại" như model cũ.
- [ ] Sửa 1 máy in đã lưu (đổi IP LAN) — xác nhận `disconnect` + `connect` lại đúng thông số mới (không dùng nhầm connection cũ trong Registry).
- [ ] Khởi động lại app, `reconnect()` 1 máy in đã lưu trước đó — xác nhận rơi về lỗi `PRINTER_NOT_FOUND` đúng như spec (Registry rỗng sau restart), rồi `connect()` lại bình thường.

---

## Self-Review

**Spec coverage:** mục 1-2 (phạm vi) → Task 11 (xoá code không thuộc phạm vi native); mục 3 (printerId) → Task 12-15 (JS giữ nguyên cách sinh, bridge nhận printerId); mục 4 (package layout) → Task 1-11; mục 5 (PrinterInfo/Capabilities/State/Result) → Task 1; mục 6 (Connection/Writer) → Task 3-6; mục 7 (PrinterDevice) → Task 7; mục 8 (Registry/Manager) → Task 8, 11; mục 9 (Queue) → Task 9; mục 10 (Error model) → Task 2, 11; mục 11 (Bridge) → Task 11; mục 12 (Threading) → xuyên suốt Task 4-11 (`CompletableFuture`); mục 13 (Discovery/Detector) → Task 10, 11; mục 14 (SOLID) → thể hiện qua tách file Task 1-10; mục 15 (JS changes) → Task 12-16; mục 16 (comment convention) → áp dụng mọi step code Task 1-16.

**Placeholder scan:** không còn "TBD"/"TODO"/"tương tự Task N" nào trong các step code — mỗi step đều có code đầy đủ. Task 16 Step 3-6 mô tả thay đổi cụ thể (tên field, tên hàm, giá trị mong đợi) thay vì "cập nhật cho phù hợp" chung chung, dù không paste toàn văn file test cũ (chưa đọc hết trong phiên brainstorm) — implementer đọc file thật trước khi sửa theo hướng dẫn đã nêu rõ.

**Type consistency:** `PrinterInfo` (Java, Task 1) ↔ `PrinterInfoDto` (TS, Task 12) khớp field (`printerId/connectionType→type/name/manufacturerName/productName/vendorId/productId/serialNumber/bluetoothAddress→address/host/port`) qua `PrinterModule.toWritableMap()` (Task 11). `PrinterConnection`/`PrinterWriter` (Task 3) dùng xuyên suốt Task 4-7 với đúng chữ ký `open()/close()/isOpen()`/`write(byte[])`. `PrinterManager` (Task 11) dùng đúng tên method đã khai ở Task 8 (`PrinterRegistry.get/put`), Task 9 (`PrinterQueueManager.getOrCreate/getIfExists/cancel/shutdownAll`, `PrinterQueue.enqueue/cancel/status/shutdown`), Task 10 (`CapabilityDetector.detect`). `ThermalPrinterModule` (TS, Task 12) dùng đúng ở `NativeAdapter.ts`/`UsbTransport.ts`/`useConnectionSetup.ts` (Task 14-15) — tên method giống hệt (`discoverPrinters/connect/reconnect/disconnect/writeByBase64`).

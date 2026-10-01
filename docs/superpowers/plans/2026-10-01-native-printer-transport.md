# Tầng native thiết bị (`com.ndtcorepos`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay `com.ndtcorepos.thermalprinter` bằng tầng native mới `bridge/` + `common/` + `device/` (chỉ nhận địa chỉ, trả `connectionId`, có `read`, xử lý mất kết nối/chen ngang đúng một lần) và chuyển TS sang module JS `DeviceModule`.

**Architecture:** `DeviceModule` (bridge, nơi duy nhất biết React Native) → `DeviceFactory.create` → `DeviceService` → `discovery/` và `ConnectionPool` → `Connection` (một luồng mỗi kết nối) → `ITransport` (USB/Bluetooth/LAN). Monitor báo `ConnectionPool.onHardwareLost`; `ConnectionPool` báo `IDisconnectListener` (= `DeviceModule`). Bên TS, `NativeAdapter` dùng `nativeConnectionPool` (đếm số máy in dùng chung một kết nối).

**Tech Stack:** Java 17 (Android, minSdk 24, compileSdk 36), androidx.core (qua react-android), JUnit 4.13.2; TypeScript strict, Jest (preset react-native).

**Spec:** `docs/superpowers/specs/2026-10-01-native-printer-transport-design.md`

## Global Constraints

- Repo `C:\NDTCORE\NDTCore\NDTCore.App`, branch `refactor/native-printer-transport`. Không dùng git worktree, không commit thẳng `main`, không push.
- Không bao giờ `git add -A` / `git add .`; chỉ add đúng đường dẫn ghi trong task. `.claude/worktrees/` giữ untracked.
- Commit message tiếng Anh, kết thúc bằng trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (lệnh commit trong task đã có sẵn).
- Code trong plan đã chạy thử: chép **nguyên văn**, không "cải tiến". Script sửa file dừng và báo nếu thiếu đoạn cũ — khi đó dừng task, không sửa tay cho khớp.
- Quy ước code (spec §13), áp cho mọi file mới/sửa:
  1. Summary ngắn tiếng Việt cho class/interface/type và field (ý nghĩa + đơn vị + ràng buộc); bỏ field tên đã hiển nhiên.
  2. Không Javadoc rập khuôn (`@param x raw bytes`, `@return operation result`).
  3. 1 dòng trống giữa các field và giữa các method; không dòng trống thừa.
  4. Comment tiếng Việt 1–3 dòng, chỉ WHY; không kể lịch sử, **không tham chiếu tài liệu** (số mục spec, tên plan/task).
  5. Dòng ≤ 120 ký tự, đo bằng Node `line.length`.
  6. Nesting: Java ≤ 2 cấp, TS ≤ 3 cấp; guard clause, không `else` sau `return`.
  7. 1 hàm 1 trách nhiệm; nhánh theo loại thiết bị chỉ điều phối.
  8. Không magic number: hằng `UPPER_SNAKE_CASE` có đơn vị.
  9. Tên đầy đủ, không viết tắt; interface tiền tố `I`.
  10. ≥ 3 tham số thì mỗi tham số 1 dòng.
  11. TS import module khác qua barrel nếu có.
  12. Verify trước mỗi commit (lệnh trong từng task).
- Lệnh Gradle chạy trong Git Bash. Lần build đầu trên máy có thể mất tới ~15 phút; các lần sau vài chục giây. Không dùng `--rerun-tasks` (build lại toàn bộ); muốn chạy lại test thì thêm `:app:cleanTestDebugUnitTest`.
- Script kiểm quy ước (lưu ra thư mục tạm của bạn, không lưu vào repo), dùng ở bước "Kiểm quy ước" của mỗi task:

**Script: `check-style.js`**

```js
// Dùng: node check-style.js <file hoặc thư mục>... — báo dòng > 120 ký tự, khai báo Java ≥ 3 tham số trên 1 dòng,
// và tên đầy đủ `java.util.X.` viết thẳng trong code. Không in gì nghĩa là đạt.
const fs = require('fs');
const path = require('path');

const MAX_LINE_LENGTH = 120;
const MIN_PARAMS_PER_LINE_RULE = 3;

function collect(target, files) {
  if (fs.statSync(target).isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      collect(path.join(target, entry), files);
    }

    return files;
  }

  if (/\.(java|ts|tsx|js)$/.test(target)) {
    files.push(target);
  }

  return files;
}

const declaration = /^\s*(public |private |protected |static |final |synchronized |<[^>]+> )*[\w<>\[\], ?]+\s+\w+\(([^()]*)\)\s*(throws [\w, ]+)?\s*\{?\s*$/;

for (const file of process.argv.slice(2).flatMap((target) => collect(target, []))) {
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
    const location = file + ':' + (index + 1);

    if (line.length > MAX_LINE_LENGTH) {
      console.log('DÒNG DÀI ' + location + ' (' + line.length + ')');
    }

    if (!file.endsWith('.java')) {
      return;
    }

    const match = line.match(declaration);
    const isStatement = /^\s*(return|if|for|while|new)\b/.test(line) || line.includes(' new ');

    if (match && !isStatement && match[2].split(',').length >= MIN_PARAMS_PER_LINE_RULE) {
      console.log('THAM SỐ ' + location + ': ' + line.trim());
    }

    if (/java\.util\.\w+\./.test(line) && !line.trim().startsWith('import')) {
      console.log('TÊN ĐẦY ĐỦ ' + location + ': ' + line.trim());
    }
  });
}
```

## Review Focus

- Rút dây USB giữa một lệnh in dài: app nhận `DeviceDisconnected` đúng một lần, lệnh đang chờ nhận `CONNECTION_LOST` (không treo), cắm lại kết nối được — test ở Task 2 (`ConnectionPoolTest`), kiểm trên máy ở Task 9.
- Hai máy USB cùng model không có serial: báo lỗi rõ (`AMBIGUOUS_DEVICE` → "Có nhiều máy in USB cùng loại…"), không in nhầm máy — `UsbDiscoveryTest` (Task 3) + `toPrinterError.test` (Task 7).
- Reload JS khi hộp thoại quyền USB đang mở: `connect` đang chờ kết thúc bằng `SERVICE_CLOSED`, receiver tạm được huỷ, không thêm kết nối sau khi pool đóng — `ConnectionPoolTest.closeAllWhileFindingDeviceRejectsWithServiceClosed` (Task 2), kiểm trên máy ở Task 9.
- Mất mạng LAN / ra khỏi tầm Bluetooth mà socket không báo lỗi: ghi kết thúc đúng hạn bằng `WRITE_TIMEOUT` kèm số byte đã gửi, rồi phát mất kết nối — `StreamWriterTest` (Task 4) + `ConnectionTest.failureThatLeavesTransportClosedReportsTransportLost` (Task 2).
- Máy in USB không có endpoint đọc: lệnh dò TSPL không làm treo luồng thêm máy in, `identify` trả `null` — `NativeAdapter.read` đổi lỗi native qua `toPrinterError` (Task 7), `TsplDriver.identify` đã bắt lỗi.

## Quyết định khi viết plan (lệch nhẹ so với spec, có lý do)

- `Connection` nhận `Consumer<Connection> transportLostHandler` (spec ghi `Runnable`): pool cần biết đúng đối tượng để không xoá nhầm kết nối mới cùng `connectionId`.
- `Connection` có thêm `serialNumber()`; `DeviceService` nhận thêm `ScheduledExecutorService timerExecutor` (luồng hẹn giờ của transport) để tắt nó khi đóng.
- TS chưa truyền `devicePath` khi kết nối máy đã lưu (không lưu đường dẫn vì đổi khi cắm lại): hai máy USB giống hệt nhau không serial sẽ nhận `AMBIGUOUS_DEVICE` — an toàn, ghi lại cho spec tầng TS.
- Serial sau khi cấp quyền được lấy bằng `refreshUsbSerial` hiện có (quét lại, khớp theo `devicePath` thay vì vendorId/productId) thay vì đưa kết quả `connect` qua driver lên hook — cùng kết quả, ít thay đổi.
- `PrinterDevice.deviceId` của USB giữ dạng `vendorId:productId` như dữ liệu đã lưu và luồng sửa máy in.
- Hai file test driver (`EscPosDriver.test.ts`, `TsplDriver.test.ts`) đổi bằng script cơ học, giữ định dạng dòng có sẵn (đã có nhiều dòng > 120 từ trước); file TS mới/viết lại thì theo đúng quy ước.
- `jest.setup.js` mock `NativeConnectionPool` bằng bản "đi thẳng" (singleton thật làm bộ đếm lọt giữa các test); `NativeConnectionPool.test.ts` dùng bản thật.
- Thêm helper test `Futures.java`; Java dùng `ContextCompat.registerReceiver` / `IntentCompat.getParcelableExtra` (androidx.core) thay vì tự rẽ nhánh theo SDK.

---

### Task 1: Nền — lỗi, model, `common/`, cấu hình JUnit

**Files:**
- Modify: `android/app/build.gradle` (thêm `testOptions` + `testImplementation junit`)
- Create: `android/app/src/main/java/com/ndtcorepos/common/CodedException.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/error/DeviceErrorCode.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/error/DeviceException.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/model/DeviceType.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/model/DeviceAddress.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/model/DeviceInfo.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/model/ConnectedDevice.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/model/DisconnectReason.java`
- Test: `android/app/src/test/java/com/ndtcorepos/common/CodedExceptionTest.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/model/DeviceAddressTest.java`

**Interfaces:**
- Produces: `CodedException.code()`; `DeviceErrorCode` (13 mã); `DeviceException(code, message[, cause])`, `withBytesWritten(int)`, `errorCode()`, `bytesWritten()`; `DeviceType.fromWireValue/wireValue`; `DeviceAddress.usb(vendorId, productId, serialNumber, devicePath)`, `.bluetooth(mac)`, `.lan(host, port)`, `lookupKey()` và getter; `DeviceInfo.usb(...)`, `.bluetooth(deviceId, name, address)`; `ConnectedDevice(connectionId, serialNumber)`; `DisconnectReason.wireValue()`.

- [ ] **Step 1: Cấu hình JUnit** — lưu script rồi chạy `node task1-edits.js .` ở gốc repo.

**Script: `task1-edits.js`**

```js
// Dùng: node <script> <đường dẫn gốc repo NDTCore.App>. Thiếu đoạn cũ ở đâu thì dừng và báo, không sửa dở.
const fs = require('fs');
const path = require('path');
const base = process.argv[2];

function applyEdits(edits) {
  const updates = [];

  for (const [relative, pairs] of Object.entries(edits)) {
    const file = path.join(base, relative);
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    let text = raw.replace(/\r\n/g, '\n');

    for (const [from, to] of pairs) {
      if (!text.includes(from)) {
        throw new Error('Không thấy đoạn cần sửa trong ' + relative + ':\n' + from.slice(0, 200));
      }

      text = text.replace(from, to);
    }

    updates.push([file, crlf ? text.replace(/\n/g, '\r\n') : text]);
  }

  for (const [file, text] of updates) {
    fs.writeFileSync(file, text);
  }

  console.log('Đã sửa ' + updates.length + ' file');
}

applyEdits({
  'android/app/build.gradle': [
    [
      '            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"\n        }\n    }\n}\n',
      '            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"\n        }\n    }\n    testOptions {\n        // Lời gọi android.util.Log trong JUnit trả giá trị mặc định thay vì ném lỗi "not mocked".\n        unitTests.returnDefaultValues = true\n    }\n}\n',
    ],
    [
      '        implementation jscFlavor\n    }\n\n}\n',
      '        implementation jscFlavor\n    }\n\n    testImplementation("junit:junit:4.13.2")\n}\n',
    ],
  ],
});
```

- [ ] **Step 2: Viết test (chưa có code nên chưa compile được)**

**File: `android/app/src/test/java/com/ndtcorepos/common/CodedExceptionTest.java`**

```java
package com.ndtcorepos.common;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;

import org.junit.Test;

public class CodedExceptionTest {

    private static final class SampleException extends CodedException {

        private SampleException(String message, Throwable cause) {
            super(message, cause);
        }

        @Override
        public String code() {
            return "SAMPLE_CODE";
        }
    }

    @Test
    public void keepsCodeMessageAndCause() {
        IllegalStateException cause = new IllegalStateException("gốc");

        CodedException exception = new SampleException("thông báo", cause);

        assertEquals("SAMPLE_CODE", exception.code());
        assertEquals("thông báo", exception.getMessage());
        assertSame(cause, exception.getCause());
    }
}
```

**File: `android/app/src/test/java/com/ndtcorepos/device/model/DeviceAddressTest.java`**

```java
package com.ndtcorepos.device.model;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.Test;

public class DeviceAddressTest {

    private interface IAddressFactory {
        DeviceAddress create() throws DeviceException;
    }

    @Test
    public void usbLookupKeyPrefersSerialThenDevicePath() throws Exception {
        assertEquals("usb:8137:8214:SN1", DeviceAddress.usb(8137, 8214, "SN1", "/dev/bus/usb/001/004").lookupKey());
        assertEquals("usb:8137:8214:@/dev/bus/usb/001/004", DeviceAddress.usb(8137, 8214, null, "/dev/bus/usb/001/004")
                .lookupKey());
        assertEquals("usb:8137:8214", DeviceAddress.usb(8137, 8214, null, null).lookupKey());
    }

    @Test
    public void usbEmptySerialAndPathBecomeNull() throws Exception {
        DeviceAddress address = DeviceAddress.usb(1, 2, "", "");

        assertNull(address.serialNumber());
        assertNull(address.devicePath());
    }

    @Test
    public void usbIdsOutsideRangeAreInvalid() {
        assertInvalid(() -> DeviceAddress.usb(-1, 2, null, null));
        assertInvalid(() -> DeviceAddress.usb(1, 70_000, null, null));
    }

    @Test
    public void bluetoothMacIsUppercased() throws Exception {
        DeviceAddress address = DeviceAddress.bluetooth("66:22:a1:b2:c3:d4");

        assertEquals("66:22:A1:B2:C3:D4", address.mac());
        assertEquals("bluetooth:66:22:A1:B2:C3:D4", address.lookupKey());
    }

    @Test
    public void blankBluetoothMacIsInvalid() {
        assertInvalid(() -> DeviceAddress.bluetooth(" "));
    }

    @Test
    public void lanValidatesHostAndPort() throws Exception {
        assertEquals("lan:192.168.1.50:9100", DeviceAddress.lan("192.168.1.50", 9100).lookupKey());
        assertInvalid(() -> DeviceAddress.lan("192.168.1.50", 0));
        assertInvalid(() -> DeviceAddress.lan("", 9100));
    }

    private static void assertInvalid(IAddressFactory factory) {
        try {
            factory.create();
            fail("Mong đợi INVALID_ARGUMENT");
        } catch (DeviceException exception) {
            assertEquals(DeviceErrorCode.INVALID_ARGUMENT, exception.errorCode());
        }
    }
}
```

- [ ] **Step 3: Chạy test, mong đợi FAIL** — `cd android && ./gradlew :app:testDebugUnitTest --tests "com.ndtcorepos.common.*" --tests "com.ndtcorepos.device.model.*" -q` → lỗi compile "cannot find symbol" (`CodedException`, `DeviceAddress`…).

- [ ] **Step 4: Viết code**

**File: `android/app/src/main/java/com/ndtcorepos/common/CodedException.java`**

```java
package com.ndtcorepos.common;

/** Lỗi có mã dạng chuỗi; bridge reject Promise bằng mã này mà không cần biết lỗi thuộc tính năng nào. */
public abstract class CodedException extends Exception {

    protected CodedException(String message, Throwable cause) {
        super(message, cause);
    }

    /** Mã lỗi JS nhận được. */
    public abstract String code();
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/error/DeviceErrorCode.java`**

```java
package com.ndtcorepos.device.error;

/** Mã lỗi của tầng thiết bị; tên enum chính là mã JS nhận được. */
public enum DeviceErrorCode {
    INVALID_ARGUMENT,
    DEVICE_NOT_FOUND,
    AMBIGUOUS_DEVICE,
    PERMISSION_DENIED,
    BLUETOOTH_DISABLED,
    CONNECTION_FAILED,
    NOT_CONNECTED,
    CONNECTION_LOST,
    WRITE_FAILED,
    WRITE_TIMEOUT,
    READ_NOT_SUPPORTED,
    READ_FAILED,
    SERVICE_CLOSED
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/error/DeviceException.java`**

```java
package com.ndtcorepos.device.error;

import com.ndtcorepos.common.CodedException;

/** Lỗi của tầng thiết bị. */
public final class DeviceException extends CodedException {

    private final DeviceErrorCode errorCode;

    /** Số byte chắc chắn đã gửi trước khi lỗi; chỉ có nghĩa với lỗi xảy ra khi ghi. */
    private final int bytesWritten;

    public DeviceException(DeviceErrorCode errorCode, String message) {
        this(errorCode, message, null, 0);
    }

    public DeviceException(
            DeviceErrorCode errorCode,
            String message,
            Throwable cause) {
        this(errorCode, message, cause, 0);
    }

    private DeviceException(
            DeviceErrorCode errorCode,
            String message,
            Throwable cause,
            int bytesWritten) {
        super(message, cause);
        this.errorCode = errorCode;
        this.bytesWritten = bytesWritten;
    }

    /** Bản sao cùng mã và thông báo, kèm số byte đã gửi. */
    public DeviceException withBytesWritten(int bytesWritten) {
        return new DeviceException(errorCode, getMessage(), getCause(), bytesWritten);
    }

    public DeviceErrorCode errorCode() {
        return errorCode;
    }

    public int bytesWritten() {
        return bytesWritten;
    }

    @Override
    public String code() {
        return errorCode.name();
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/model/DeviceType.java`**

```java
package com.ndtcorepos.device.model;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

/** Loại đường truyền tới thiết bị. */
public enum DeviceType {
    USB("usb"),
    BLUETOOTH("bluetooth"),
    LAN("lan");

    /** Giá trị trao đổi với JS. */
    private final String wireValue;

    DeviceType(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static DeviceType fromWireValue(String wireValue) throws DeviceException {
        for (DeviceType type : values()) {
            if (type.wireValue.equals(wireValue)) {
                return type;
            }
        }

        throw new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, "Loại thiết bị không hợp lệ: " + wireValue);
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/model/DeviceAddress.java`**

```java
package com.ndtcorepos.device.model;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.util.Locale;

/** Cách tới một thiết bị: USB theo vendorId/productId/serial, Bluetooth theo MAC, LAN theo host/port. */
public final class DeviceAddress {

    private static final int MAX_USB_ID = 0xFFFF;

    private static final int MIN_PORT = 1;

    private static final int MAX_PORT = 65_535;

    private final DeviceType type;

    private final int vendorId;

    private final int productId;

    /** Serial USB; `null` khi không biết (chưa có quyền hoặc thiết bị không có). */
    private final String serialNumber;

    /** Đường dẫn thiết bị USB lấy từ lần quét, vd `/dev/bus/usb/001/004`; chỉ đúng trong lần cắm hiện tại. */
    private final String devicePath;

    /** MAC Bluetooth, luôn viết hoa. */
    private final String mac;

    private final String host;

    private final int port;

    private DeviceAddress(
            DeviceType type,
            int vendorId,
            int productId,
            String serialNumber,
            String devicePath,
            String mac,
            String host,
            int port) {
        this.type = type;
        this.vendorId = vendorId;
        this.productId = productId;
        this.serialNumber = serialNumber;
        this.devicePath = devicePath;
        this.mac = mac;
        this.host = host;
        this.port = port;
    }

    public static DeviceAddress usb(
            int vendorId,
            int productId,
            String serialNumber,
            String devicePath) throws DeviceException {
        requireInRange(vendorId, 0, MAX_USB_ID, "vendorId");
        requireInRange(productId, 0, MAX_USB_ID, "productId");
        return new DeviceAddress(
                DeviceType.USB,
                vendorId,
                productId,
                emptyToNull(serialNumber),
                emptyToNull(devicePath),
                null,
                null,
                0);
    }

    public static DeviceAddress bluetooth(String mac) throws DeviceException {
        String normalizedMac = requireNotBlank(mac, "mac").toUpperCase(Locale.ROOT);
        return new DeviceAddress(DeviceType.BLUETOOTH, 0, 0, null, null, normalizedMac, null, 0);
    }

    public static DeviceAddress lan(String host, int port) throws DeviceException {
        requireInRange(port, MIN_PORT, MAX_PORT, "port");
        return new DeviceAddress(DeviceType.LAN, 0, 0, null, null, null, requireNotBlank(host, "host"), port);
    }

    /** Khoá gộp các lần kết nối đồng thời cùng địa chỉ, dùng trước khi biết đó là thiết bị vật lý nào. */
    public String lookupKey() {
        if (type == DeviceType.BLUETOOTH) {
            return "bluetooth:" + mac;
        }

        if (type == DeviceType.LAN) {
            return "lan:" + host + ":" + port;
        }

        return usbLookupKey();
    }

    private String usbLookupKey() {
        String base = "usb:" + vendorId + ":" + productId;

        if (serialNumber != null) {
            return base + ":" + serialNumber;
        }

        if (devicePath != null) {
            return base + ":@" + devicePath;
        }

        return base;
    }

    public DeviceType type() {
        return type;
    }

    public int vendorId() {
        return vendorId;
    }

    public int productId() {
        return productId;
    }

    public String serialNumber() {
        return serialNumber;
    }

    public String devicePath() {
        return devicePath;
    }

    public String mac() {
        return mac;
    }

    public String host() {
        return host;
    }

    public int port() {
        return port;
    }

    private static String emptyToNull(String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }

        return value;
    }

    private static String requireNotBlank(String value, String fieldName) throws DeviceException {
        if (value == null || value.trim().isEmpty()) {
            throw new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, "Thiếu " + fieldName);
        }

        return value.trim();
    }

    private static void requireInRange(
            int value,
            int min,
            int max,
            String fieldName) throws DeviceException {
        if (value < min || value > max) {
            throw new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, fieldName + " ngoài khoảng: " + value);
        }
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/model/DeviceInfo.java`**

```java
package com.ndtcorepos.device.model;

/** Một thiết bị tìm thấy khi quét, chưa kết nối. */
public final class DeviceInfo {

    /** Định danh trong lần cắm hiện tại, dùng làm key danh sách; đổi khi rút ra cắm lại. */
    private final String deviceId;

    private final String name;

    /** Địa chỉ để TS truyền lại nguyên vẹn khi kết nối. */
    private final DeviceAddress address;

    /** Chỉ USB. */
    private final String manufacturerName;

    /** Chỉ USB. */
    private final String productName;

    /** Chỉ USB: app đã được cấp quyền dùng thiết bị này chưa. */
    private final boolean hasPermission;

    private DeviceInfo(
            String deviceId,
            String name,
            DeviceAddress address,
            String manufacturerName,
            String productName,
            boolean hasPermission) {
        this.deviceId = deviceId;
        this.name = name;
        this.address = address;
        this.manufacturerName = manufacturerName;
        this.productName = productName;
        this.hasPermission = hasPermission;
    }

    public static DeviceInfo usb(
            String deviceId,
            String name,
            DeviceAddress address,
            String manufacturerName,
            String productName,
            boolean hasPermission) {
        return new DeviceInfo(deviceId, name, address, manufacturerName, productName, hasPermission);
    }

    public static DeviceInfo bluetooth(
            String deviceId,
            String name,
            DeviceAddress address) {
        return new DeviceInfo(deviceId, name, address, null, null, false);
    }

    public String deviceId() {
        return deviceId;
    }

    public DeviceType type() {
        return address.type();
    }

    public String name() {
        return name;
    }

    public DeviceAddress address() {
        return address;
    }

    public String manufacturerName() {
        return manufacturerName;
    }

    public String productName() {
        return productName;
    }

    public boolean hasPermission() {
        return hasPermission;
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/model/ConnectedDevice.java`**

```java
package com.ndtcorepos.device.model;

/** Kết quả kết nối thành công. */
public final class ConnectedDevice {

    /** Mã của kết nối, xác định từ thiết bị vật lý; chỉ có nghĩa trong phiên kết nối, TS không lưu. */
    private final String connectionId;

    /** Serial đọc từ thiết bị sau khi mở (USB); `null` nếu thiết bị không có hoặc đường truyền không hỗ trợ. */
    private final String serialNumber;

    public ConnectedDevice(String connectionId, String serialNumber) {
        this.connectionId = connectionId;
        this.serialNumber = serialNumber;
    }

    public String connectionId() {
        return connectionId;
    }

    public String serialNumber() {
        return serialNumber;
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/model/DisconnectReason.java`**

```java
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
```

- [ ] **Step 5: Chạy test, mong đợi PASS** — cùng lệnh Step 3 → 7 test pass.

- [ ] **Step 6: Kiểm quy ước** — `node check-style.js android/app/src/main/java/com/ndtcorepos android/app/src/test/java/com/ndtcorepos` → không in gì.

- [ ] **Step 7: Commit**

```bash
git add android/app/build.gradle
git add android/app/src/main/java/com/ndtcorepos/common/CodedException.java
git add android/app/src/main/java/com/ndtcorepos/device/error/DeviceErrorCode.java
git add android/app/src/main/java/com/ndtcorepos/device/error/DeviceException.java
git add android/app/src/main/java/com/ndtcorepos/device/model/DeviceType.java
git add android/app/src/main/java/com/ndtcorepos/device/model/DeviceAddress.java
git add android/app/src/main/java/com/ndtcorepos/device/model/DeviceInfo.java
git add android/app/src/main/java/com/ndtcorepos/device/model/ConnectedDevice.java
git add android/app/src/main/java/com/ndtcorepos/device/model/DisconnectReason.java
git add android/app/src/test/java/com/ndtcorepos/common/CodedExceptionTest.java
git add android/app/src/test/java/com/ndtcorepos/device/model/DeviceAddressTest.java
git commit -m "feat: add device model, errors and JUnit setup for native layer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Kết nối — `Connection`, `ConnectionPool`, test đồng thời

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/device/transport/ITransport.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/transport/ITransportFactory.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/connection/IDisconnectListener.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/connection/Connection.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/connection/ConnectionPool.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/connection/FakeTransport.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/connection/FakeTransportFactory.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/connection/Futures.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/connection/ConnectionTest.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/connection/ConnectionPoolTest.java`

**Interfaces:**
- Consumes (Task 1): `DeviceException`, `DeviceErrorCode`, `DeviceAddress.lookupKey()/type()`, `DeviceType.wireValue()`, `ConnectedDevice`, `DisconnectReason`.
- Produces: `ITransport` (`open`, `write(data, deadlineMillis)`, `read(maxBytes, deadlineMillis)`, `close`, `isOpen`, `hardwareAddress`, `serialNumber`); `ITransportFactory.create(DeviceAddress)`; `IDisconnectListener.onDisconnected(connectionId, reason)`; `ConnectionPool(transportFactory, listener, connectExecutor, abortExecutor, operationExecutorFactory)` với `connect(DeviceAddress) → CompletableFuture<ConnectedDevice>`, `write(connectionId, data, timeoutMillis)`, `read(connectionId, maxBytes, timeoutMillis)`, `disconnect(connectionId)`, `onHardwareLost(hardwareAddress, reason)`, `closeAll()`; `connectionId` = `type.wireValue() + ":" + transport.hardwareAddress()`.

- [ ] **Step 1: Viết bản giả và test**

**File: `android/app/src/test/java/com/ndtcorepos/device/connection/FakeTransport.java`**

```java
package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.transport.ITransport;

import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** Transport giả: điều khiển được ghi chậm, lỗi, hết hạn, trạng thái mở để test mà không cần thiết bị thật. */
final class FakeTransport implements ITransport {

    private static final long GATE_POLL_INTERVAL_MS = 10;

    private final String hardwareAddress;

    private final String serialNumber;

    /** Nhật ký dùng chung giữa các transport để kiểm thứ tự mở/đóng. */
    private final List<String> events;

    final AtomicInteger openCount = new AtomicInteger();

    final AtomicInteger closeCount = new AtomicInteger();

    final List<byte[]> writes = new CopyOnWriteArrayList<>();

    final List<Long> writeDeadlines = new CopyOnWriteArrayList<>();

    final Queue<byte[]> readResponses = new ConcurrentLinkedQueue<>();

    /** Khác `null` thì `open` chờ latch này mở. */
    volatile CountDownLatch openGate;

    final CountDownLatch openEntered = new CountDownLatch(1);

    /** Khác `null` thì `write` chờ latch này mở, hoặc tới khi transport bị đóng. */
    volatile CountDownLatch writeGate;

    final CountDownLatch writeEntered = new CountDownLatch(1);

    /** Số byte báo đã gửi khi lần ghi đang chờ bị cắt ngang do đóng transport. */
    volatile int bytesSentBeforeClose;

    volatile DeviceException nextWriteFailure;

    /** Lỗi ghi kế tiếp làm transport không còn dùng được. */
    volatile boolean closeOnWriteFailure;

    volatile boolean open;

    FakeTransport(
            String hardwareAddress,
            String serialNumber,
            List<String> events) {
        this.hardwareAddress = hardwareAddress;
        this.serialNumber = serialNumber;
        this.events = events;
    }

    @Override
    public void open() throws DeviceException {
        openEntered.countDown();
        awaitGate(openGate);
        open = true;
        openCount.incrementAndGet();
        events.add("open:" + hardwareAddress);
    }

    @Override
    public void write(byte[] data, long deadlineMillis) throws DeviceException {
        writeDeadlines.add(deadlineMillis);
        writeEntered.countDown();
        awaitGate(writeGate);

        if (!open) {
            throw new DeviceException(DeviceErrorCode.WRITE_FAILED, "đã đóng").withBytesWritten(bytesSentBeforeClose);
        }

        DeviceException failure = nextWriteFailure;

        if (failure != null) {
            nextWriteFailure = null;
            open = !closeOnWriteFailure;
            throw failure;
        }

        writes.add(data);
    }

    @Override
    public byte[] read(int maxBytes, long deadlineMillis) {
        byte[] response = readResponses.poll();
        return response == null ? new byte[0] : response;
    }

    @Override
    public void close() {
        closeCount.incrementAndGet();

        if (open) {
            events.add("close:" + hardwareAddress);
        }

        open = false;
    }

    @Override
    public boolean isOpen() {
        return open;
    }

    @Override
    public String hardwareAddress() {
        return hardwareAddress;
    }

    @Override
    public String serialNumber() {
        return serialNumber;
    }

    /** Chờ latch mở; transport bị đóng trong lúc chờ thì thôi chờ (giống socket bị cắt ngang). */
    private void awaitGate(CountDownLatch gate) {
        if (gate == null) {
            return;
        }

        try {
            while (!gate.await(GATE_POLL_INTERVAL_MS, TimeUnit.MILLISECONDS) && closeCount.get() == 0) {
                Thread.yield();
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
```

**File: `android/app/src/test/java/com/ndtcorepos/device/connection/FakeTransportFactory.java`**

```java
package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.transport.ITransport;
import com.ndtcorepos.device.transport.ITransportFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Factory giả: mỗi lần tạo một `FakeTransport`, địa chỉ phần cứng tra theo `lookupKey` của địa chỉ. */
final class FakeTransportFactory implements ITransportFactory {

    private static final long GATE_TIMEOUT_SECONDS = 5;

    /** `lookupKey` → địa chỉ phần cứng; không có thì dùng `lookupKey` bỏ tiền tố loại (vd `10.0.0.1:9100`). */
    final Map<String, String> hardwareByLookupKey = new ConcurrentHashMap<>();

    final List<FakeTransport> created = new CopyOnWriteArrayList<>();

    /** Nhật ký mở/đóng dùng chung của mọi transport đã tạo. */
    final List<String> events = Collections.synchronizedList(new ArrayList<>());

    final CountDownLatch createEntered = new CountDownLatch(1);

    /** Khác `null` thì `create` chờ latch này (giả lập chờ hộp thoại quyền USB). */
    volatile CountDownLatch createGate;

    /** Gắn vào mọi transport tạo ra: `open` chờ latch này. */
    volatile CountDownLatch openGate;

    volatile String serialNumber;

    @Override
    public ITransport create(DeviceAddress address) {
        createEntered.countDown();
        awaitGate(createGate);
        String lookupKey = address.lookupKey();
        String defaultHardwareAddress = lookupKey.substring(lookupKey.indexOf(':') + 1);
        String hardwareAddress = hardwareByLookupKey.getOrDefault(lookupKey, defaultHardwareAddress);
        FakeTransport transport = new FakeTransport(hardwareAddress, serialNumber, events);
        transport.openGate = openGate;
        created.add(transport);
        return transport;
    }

    FakeTransport transport(int index) {
        return created.get(index);
    }

    private static void awaitGate(CountDownLatch gate) {
        if (gate == null) {
            return;
        }

        try {
            gate.await(GATE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
```

**File: `android/app/src/test/java/com/ndtcorepos/device/connection/Futures.java`**

```java
package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceException;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

/** Tiện ích chờ kết quả bất đồng bộ trong test, có giới hạn thời gian để test không treo. */
final class Futures {

    private static final long TIMEOUT_SECONDS = 5;

    private static final long POLL_INTERVAL_MS = 10;

    private Futures() {
    }

    static <T> T await(CompletableFuture<T> future) throws Exception {
        return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    /** Lỗi thiết bị mà future kết thúc với; future thành công thì ném AssertionError. */
    static DeviceException failureOf(CompletableFuture<?> future) throws Exception {
        try {
            future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (ExecutionException exception) {
            return (DeviceException) exception.getCause();
        }

        throw new AssertionError("Future thành công, mong đợi lỗi");
    }

    static void awaitLatch(CountDownLatch latch) throws InterruptedException {
        if (!latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            throw new AssertionError("Chờ latch quá lâu");
        }
    }

    static void awaitCondition(BooleanSupplier condition) throws InterruptedException {
        long deadline = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS);

        while (!condition.getAsBoolean()) {
            if (System.currentTimeMillis() > deadline) {
                throw new AssertionError("Chờ điều kiện quá lâu");
            }

            Thread.sleep(POLL_INTERVAL_MS);
        }
    }
}
```

**File: `android/app/src/test/java/com/ndtcorepos/device/connection/ConnectionTest.java`**

```java
package com.ndtcorepos.device.connection;

import static com.ndtcorepos.device.connection.Futures.await;
import static com.ndtcorepos.device.connection.Futures.awaitLatch;
import static com.ndtcorepos.device.connection.Futures.failureOf;
import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class ConnectionTest {

    private static final long LONG_TIMEOUT_MS = 10_000;

    private static final long SHORT_TIMEOUT_MS = 100;

    private static final long QUEUE_DELAY_MS = 300;

    private final FakeTransport transport =
            new FakeTransport("10.0.0.1:9100", null, Collections.synchronizedList(new ArrayList<>()));

    private final AtomicInteger transportLostCount = new AtomicInteger();

    private Connection connection;

    @Before
    public void setUp() throws Exception {
        transport.open();
        connection = new Connection(
                "lan:10.0.0.1:9100",
                transport,
                Executors.newSingleThreadExecutor(),
                lost -> transportLostCount.incrementAndGet());
    }

    @Test
    public void writesRunInCallOrder() throws Exception {
        CompletableFuture<Void> first = connection.write(new byte[] {1}, LONG_TIMEOUT_MS);
        CompletableFuture<Void> second = connection.write(new byte[] {2}, LONG_TIMEOUT_MS);
        CompletableFuture<Void> third = connection.write(new byte[] {3}, LONG_TIMEOUT_MS);
        await(CompletableFuture.allOf(first, second, third));

        assertEquals(3, transport.writes.size());
        assertArrayEquals(new byte[] {1}, transport.writes.get(0));
        assertArrayEquals(new byte[] {2}, transport.writes.get(1));
        assertArrayEquals(new byte[] {3}, transport.writes.get(2));
    }

    @Test
    public void deadlineCountsFromWhenOperationStartsNotWhenQueued() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        transport.writeGate = gate;
        CompletableFuture<Void> first = connection.write(new byte[] {1}, LONG_TIMEOUT_MS);
        awaitLatch(transport.writeEntered);

        long queuedAt = System.currentTimeMillis();
        CompletableFuture<Void> second = connection.write(new byte[] {2}, SHORT_TIMEOUT_MS);
        Thread.sleep(QUEUE_DELAY_MS);
        gate.countDown();
        await(CompletableFuture.allOf(first, second));

        long secondDeadline = transport.writeDeadlines.get(1);
        assertTrue(secondDeadline >= queuedAt + QUEUE_DELAY_MS + SHORT_TIMEOUT_MS);
    }

    @Test
    public void closeWaitsForQueuedOperations() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        transport.writeGate = gate;
        CompletableFuture<Void> write = connection.write(new byte[] {1}, LONG_TIMEOUT_MS);
        awaitLatch(transport.writeEntered);

        CompletableFuture<Void> close = connection.close();
        Thread.sleep(SHORT_TIMEOUT_MS);
        assertFalse(close.isDone());
        assertTrue(transport.isOpen());

        gate.countDown();
        await(close);
        await(write);
        assertFalse(transport.isOpen());
    }

    @Test
    public void operationAfterCloseIsNotConnected() throws Exception {
        await(connection.close());

        DeviceException failure = failureOf(connection.write(new byte[] {1}, LONG_TIMEOUT_MS));

        assertEquals(DeviceErrorCode.NOT_CONNECTED, failure.errorCode());
    }

    @Test
    public void abortEndsRunningAndWaitingOperationsWithConnectionLost() throws Exception {
        transport.writeGate = new CountDownLatch(1);
        transport.bytesSentBeforeClose = 7;
        CompletableFuture<Void> running = connection.write(new byte[10], LONG_TIMEOUT_MS);
        awaitLatch(transport.writeEntered);
        CompletableFuture<Void> waiting = connection.write(new byte[] {2}, LONG_TIMEOUT_MS);

        connection.abort();

        DeviceException runningFailure = failureOf(running);
        assertEquals(DeviceErrorCode.CONNECTION_LOST, runningFailure.errorCode());
        assertEquals(7, runningFailure.bytesWritten());
        assertEquals(DeviceErrorCode.CONNECTION_LOST, failureOf(waiting).errorCode());
        assertEquals(0, transportLostCount.get());
    }

    @Test
    public void failureThatLeavesTransportClosedReportsTransportLost() throws Exception {
        transport.nextWriteFailure = new DeviceException(DeviceErrorCode.WRITE_TIMEOUT, "hết hạn").withBytesWritten(3);
        transport.closeOnWriteFailure = true;

        DeviceException failure = failureOf(connection.write(new byte[10], LONG_TIMEOUT_MS));

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(3, failure.bytesWritten());
        assertEquals(1, transportLostCount.get());
    }

    @Test
    public void timeoutWithTransportStillOpenKeepsConnection() throws Exception {
        transport.nextWriteFailure = new DeviceException(DeviceErrorCode.WRITE_TIMEOUT, "hết hạn");

        DeviceException failure = failureOf(connection.write(new byte[10], LONG_TIMEOUT_MS));

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(0, transportLostCount.get());
        assertTrue(connection.isAlive());
        await(connection.write(new byte[] {1}, LONG_TIMEOUT_MS));
    }

    @Test
    public void abortDuringCloseCompletesCloseNormally() throws Exception {
        transport.writeGate = new CountDownLatch(1);
        connection.write(new byte[] {1}, LONG_TIMEOUT_MS);
        awaitLatch(transport.writeEntered);
        CompletableFuture<Void> close = connection.close();

        connection.abort();

        assertNull(await(close));
        assertFalse(transport.isOpen());
    }

    @Test
    public void readReturnsAvailableBytesOrEmptyArray() throws Exception {
        transport.readResponses.add(new byte[] {1, 2});

        assertArrayEquals(new byte[] {1, 2}, await(connection.read(16, LONG_TIMEOUT_MS)));
        assertEquals(0, await(connection.read(16, SHORT_TIMEOUT_MS)).length);
    }
}
```

**File: `android/app/src/test/java/com/ndtcorepos/device/connection/ConnectionPoolTest.java`**

```java
package com.ndtcorepos.device.connection;

import static com.ndtcorepos.device.connection.Futures.await;
import static com.ndtcorepos.device.connection.Futures.awaitCondition;
import static com.ndtcorepos.device.connection.Futures.awaitLatch;
import static com.ndtcorepos.device.connection.Futures.failureOf;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.ConnectedDevice;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DisconnectReason;

import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

public class ConnectionPoolTest {

    private static final long TIMEOUT_MS = 10_000;

    private static final long SETTLE_MS = 100;

    private static final String USB_PATH = "/dev/bus/usb/001/004";

    private final FakeTransportFactory factory = new FakeTransportFactory();

    private final List<String> disconnectEvents = Collections.synchronizedList(new ArrayList<>());

    private ConnectionPool pool;

    private DeviceAddress printerA;

    private DeviceAddress printerB;

    @Before
    public void setUp() throws Exception {
        pool = new ConnectionPool(
                factory,
                (connectionId, reason) -> disconnectEvents.add(connectionId + "|" + reason.wireValue()),
                Executors.newCachedThreadPool(),
                Executors.newSingleThreadExecutor(),
                Executors::newSingleThreadExecutor);
        printerA = DeviceAddress.lan("10.0.0.1", 9100);
        printerB = DeviceAddress.lan("10.0.0.2", 9100);
    }

    @Test
    public void connectReturnsIdFromHardwareAddressAndSerial() throws Exception {
        factory.serialNumber = "SN1";

        ConnectedDevice connected = await(pool.connect(printerA));

        assertEquals("lan:10.0.0.1:9100", connected.connectionId());
        assertEquals("SN1", connected.serialNumber());
    }

    @Test
    public void concurrentConnectsToSameAddressOpenOnce() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        factory.createGate = gate;

        CompletableFuture<ConnectedDevice> first = pool.connect(printerA);
        CompletableFuture<ConnectedDevice> second = pool.connect(printerA);
        gate.countDown();

        assertSame(first, second);
        assertEquals("lan:10.0.0.1:9100", await(first).connectionId());
        assertEquals(1, factory.created.size());
        assertEquals(1, factory.transport(0).openCount.get());
    }

    @Test
    public void differentAddressesOfSameDeviceShareOneConnection() throws Exception {
        DeviceAddress bySerial = DeviceAddress.usb(1, 2, "SN", null);
        DeviceAddress byPath = DeviceAddress.usb(1, 2, null, USB_PATH);
        factory.hardwareByLookupKey.put(bySerial.lookupKey(), USB_PATH);
        factory.hardwareByLookupKey.put(byPath.lookupKey(), USB_PATH);

        String firstId = await(pool.connect(bySerial)).connectionId();
        String secondId = await(pool.connect(byPath)).connectionId();

        assertEquals("usb:" + USB_PATH, firstId);
        assertEquals(firstId, secondId);
        assertEquals(1, factory.transport(0).openCount.get());
        assertEquals(0, factory.transport(1).openCount.get());
        assertEquals(1, factory.transport(1).closeCount.get());
    }

    @Test
    public void concurrentDifferentAddressesOfSameDeviceOpenOnce() throws Exception {
        DeviceAddress bySerial = DeviceAddress.usb(1, 2, "SN", null);
        DeviceAddress byPath = DeviceAddress.usb(1, 2, null, USB_PATH);
        factory.hardwareByLookupKey.put(bySerial.lookupKey(), USB_PATH);
        factory.hardwareByLookupKey.put(byPath.lookupKey(), USB_PATH);
        CountDownLatch openGate = new CountDownLatch(1);
        factory.openGate = openGate;

        CompletableFuture<ConnectedDevice> first = pool.connect(bySerial);
        awaitCondition(() -> factory.created.size() == 1);
        awaitLatch(factory.transport(0).openEntered);
        CompletableFuture<ConnectedDevice> second = pool.connect(byPath);
        awaitCondition(() -> factory.created.size() == 2);
        Thread.sleep(SETTLE_MS);
        openGate.countDown();

        assertEquals(await(first).connectionId(), await(second).connectionId());
        assertEquals(1, factory.transport(0).openCount.get());
        assertEquals(0, factory.transport(1).openCount.get());
    }

    @Test
    public void deadConnectionIsReplacedWithoutDisconnectEvent() throws Exception {
        await(pool.connect(printerA));
        factory.transport(0).open = false;

        await(pool.connect(printerA));

        assertEquals(1, factory.transport(1).openCount.get());
        assertTrue(disconnectEvents.isEmpty());
    }

    @Test
    public void connectWhileClosingWaitsForCloseToFinish() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        CountDownLatch writeGate = new CountDownLatch(1);
        factory.transport(0).writeGate = writeGate;
        pool.write(connectionId, new byte[] {1}, TIMEOUT_MS);
        awaitLatch(factory.transport(0).writeEntered);

        CompletableFuture<Void> disconnect = pool.disconnect(connectionId);
        CompletableFuture<ConnectedDevice> reconnect = pool.connect(printerA);
        Thread.sleep(SETTLE_MS);
        assertFalse(reconnect.isDone());

        writeGate.countDown();
        await(disconnect);
        await(reconnect);
        List<String> events = new ArrayList<>(factory.events);
        assertTrue(events.indexOf("close:10.0.0.1:9100") < events.lastIndexOf("open:10.0.0.1:9100"));
    }

    @Test
    public void writeToUnknownOrDisconnectedIdIsNotConnected() throws Exception {
        DeviceException unknownId = failureOf(pool.write("lan:x", new byte[1], TIMEOUT_MS));
        assertEquals(DeviceErrorCode.NOT_CONNECTED, unknownId.errorCode());

        String connectionId = await(pool.connect(printerA)).connectionId();
        await(pool.disconnect(connectionId));

        DeviceException failure = failureOf(pool.write(connectionId, new byte[1], TIMEOUT_MS));
        assertEquals(DeviceErrorCode.NOT_CONNECTED, failure.errorCode());
    }

    @Test
    public void disconnectUnknownIdResolves() throws Exception {
        await(pool.disconnect("lan:unknown"));
    }

    @Test
    public void disconnectWhileOpeningWaitsThenCloses() throws Exception {
        CountDownLatch openGate = new CountDownLatch(1);
        factory.openGate = openGate;
        CompletableFuture<ConnectedDevice> connect = pool.connect(printerA);
        awaitCondition(() -> factory.created.size() == 1);
        awaitLatch(factory.transport(0).openEntered);

        CompletableFuture<Void> disconnect = pool.disconnect("lan:10.0.0.1:9100");
        Thread.sleep(SETTLE_MS);
        assertFalse(disconnect.isDone());

        openGate.countDown();
        await(connect);
        await(disconnect);
        assertFalse(factory.transport(0).isOpen());
    }

    @Test
    public void hardwareLostRemovesOnlyMatchingConnectionAndReportsOnce() throws Exception {
        String idA = await(pool.connect(printerA)).connectionId();
        String idB = await(pool.connect(printerB)).connectionId();

        pool.onHardwareLost("10.0.0.1:9100", DisconnectReason.USB_DETACHED);
        pool.onHardwareLost("10.0.0.1:9100", DisconnectReason.USB_DETACHED);

        assertEquals(Collections.singletonList("lan:10.0.0.1:9100|usb_detached"), disconnectEvents);
        assertEquals(DeviceErrorCode.NOT_CONNECTED, failureOf(pool.write(idA, new byte[1], TIMEOUT_MS)).errorCode());
        await(pool.write(idB, new byte[1], TIMEOUT_MS));
    }

    @Test
    public void ioErrorThenBroadcastReportsOnceWithFirstReason() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        factory.transport(0).nextWriteFailure = new DeviceException(DeviceErrorCode.WRITE_FAILED, "lỗi I/O");
        factory.transport(0).closeOnWriteFailure = true;

        DeviceException writeFailure = failureOf(pool.write(connectionId, new byte[1], TIMEOUT_MS));
        assertEquals(DeviceErrorCode.WRITE_FAILED, writeFailure.errorCode());
        awaitCondition(() -> disconnectEvents.size() == 1);
        pool.onHardwareLost("10.0.0.1:9100", DisconnectReason.BLUETOOTH_DISCONNECTED);

        assertEquals(Collections.singletonList("lan:10.0.0.1:9100|io_error"), disconnectEvents);
    }

    @Test
    public void hardwareLostDuringDisconnectIsNotReported() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        CountDownLatch writeGate = new CountDownLatch(1);
        factory.transport(0).writeGate = writeGate;
        pool.write(connectionId, new byte[] {1}, TIMEOUT_MS);
        awaitLatch(factory.transport(0).writeEntered);

        CompletableFuture<Void> disconnect = pool.disconnect(connectionId);
        pool.onHardwareLost("10.0.0.1:9100", DisconnectReason.USB_DETACHED);
        writeGate.countDown();
        await(disconnect);

        assertTrue(disconnectEvents.isEmpty());
    }

    @Test
    public void closeAllAbortsWithoutEventsAndRejectsLaterCalls() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        factory.transport(0).writeGate = new CountDownLatch(1);
        CompletableFuture<Void> write = pool.write(connectionId, new byte[] {1}, TIMEOUT_MS);
        awaitLatch(factory.transport(0).writeEntered);

        pool.closeAll();

        assertEquals(DeviceErrorCode.CONNECTION_LOST, failureOf(write).errorCode());
        assertTrue(disconnectEvents.isEmpty());
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(pool.connect(printerA)).errorCode());
        DeviceException writeAfterClose = failureOf(pool.write(connectionId, new byte[1], TIMEOUT_MS));
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, writeAfterClose.errorCode());
    }

    @Test
    public void closeAllWhileOpeningNeverAddsConnection() throws Exception {
        CountDownLatch openGate = new CountDownLatch(1);
        factory.openGate = openGate;
        CompletableFuture<ConnectedDevice> connect = pool.connect(printerA);
        awaitCondition(() -> factory.created.size() == 1);
        awaitLatch(factory.transport(0).openEntered);

        pool.closeAll();
        openGate.countDown();

        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(connect).errorCode());
        assertFalse(factory.transport(0).isOpen());
    }

    @Test
    public void closeAllWhileFindingDeviceRejectsWithServiceClosed() throws Exception {
        CountDownLatch createGate = new CountDownLatch(1);
        factory.createGate = createGate;
        CompletableFuture<ConnectedDevice> connect = pool.connect(printerA);
        awaitLatch(factory.createEntered);

        pool.closeAll();
        createGate.countDown();

        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(connect).errorCode());
        assertEquals(0, factory.transport(0).openCount.get());
    }
}
```

- [ ] **Step 2: Chạy test, mong đợi FAIL** — `cd android && ./gradlew :app:testDebugUnitTest --tests "com.ndtcorepos.device.connection.*" -q` → lỗi compile (thiếu `ITransport`, `Connection`, `ConnectionPool`).

- [ ] **Step 3: Viết code**

**File: `android/app/src/main/java/com/ndtcorepos/device/transport/ITransport.java`**

```java
package com.ndtcorepos.device.transport;

import com.ndtcorepos.device.error.DeviceException;

/**
 * Truyền byte trên một đường truyền. Mọi hạn (`deadlineMillis`) là mốc tuyệt đối theo `System.currentTimeMillis()`
 * để một lần ghi nhiều khúc không cộng dồn timeout.
 */
public interface ITransport {

    void open() throws DeviceException;

    /** Ghi đủ toàn bộ `data`, hoặc ném `WRITE_TIMEOUT`/`WRITE_FAILED` kèm số byte chắc chắn đã gửi. */
    void write(byte[] data, long deadlineMillis) throws DeviceException;

    /** Trả ngay khi có ít nhất 1 byte (tối đa `maxBytes`); hết hạn mà chưa có byte → mảng rỗng. */
    byte[] read(int maxBytes, long deadlineMillis) throws DeviceException;

    /** Không ném lỗi, gọi nhiều lần không sao; gọi được từ luồng khác để cắt ngang lần ghi/đọc đang chạy. */
    void close();

    /** Còn dùng được không, kể cả sau một lỗi. */
    boolean isOpen();

    /** Địa chỉ phần cứng (đường dẫn USB, MAC, host:port) để tạo `connectionId` và khớp sự kiện mất kết nối. */
    String hardwareAddress();

    /** Serial đọc từ thiết bị; `null` nếu không có hoặc đường truyền không hỗ trợ. */
    String serialNumber();
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/transport/ITransportFactory.java`**

```java
package com.ndtcorepos.device.transport;

import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;

/** Tạo transport cho một địa chỉ. */
public interface ITransportFactory {

    /** Tìm thiết bị (có thể xin quyền USB nên được phép chặn) và trả transport chưa mở. */
    ITransport create(DeviceAddress address) throws DeviceException;
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/connection/IDisconnectListener.java`**

```java
package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.model.DisconnectReason;

/** Nhận báo một kết nối đã mất ngoài ý muốn (không gọi khi JS chủ động ngắt). */
public interface IDisconnectListener {

    void onDisconnected(String connectionId, DisconnectReason reason);
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/connection/Connection.java`**

```java
package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.transport.ITransport;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.function.Consumer;

/** Một kết nối đang mở; mọi thao tác chạy lần lượt trên một luồng riêng. */
public final class Connection {

    private enum State {
        OPEN,
        CLOSING,
        CLOSED,
        ABORTED
    }

    /** Một thao tác trên transport. */
    private interface IOperation<T> {
        T run() throws DeviceException;
    }

    /** Mã của kết nối, xác định từ thiết bị vật lý nên mọi địa chỉ trỏ tới cùng máy cho cùng mã. */
    private final String connectionId;

    private final ITransport transport;

    /** Một luồng duy nhất: ghi/đọc/đóng của cùng kết nối không bao giờ chạy song song. */
    private final ExecutorService operationExecutor;

    /** Báo pool khi transport không còn dùng được sau một lỗi. */
    private final Consumer<Connection> transportLostHandler;

    /** Hoàn tất khi kết nối đã đóng, dù đóng bình thường hay bị abort. */
    private final CompletableFuture<Void> closeFuture = new CompletableFuture<>();

    /** Thao tác đã nhận nhưng chưa xong; chỉ đọc/ghi trong khoá của đối tượng. */
    private final Set<CompletableFuture<?>> unfinishedOperations = new HashSet<>();

    /** Thao tác đang chạy trên transport; abort để nó tự kết thúc khi transport đóng nhằm giữ đúng số byte đã gửi. */
    private CompletableFuture<?> runningOperation;

    private State state = State.OPEN;

    Connection(
            String connectionId,
            ITransport transport,
            ExecutorService operationExecutor,
            Consumer<Connection> transportLostHandler) {
        this.connectionId = connectionId;
        this.transport = transport;
        this.operationExecutor = operationExecutor;
        this.transportLostHandler = transportLostHandler;
    }

    public String connectionId() {
        return connectionId;
    }

    public String hardwareAddress() {
        return transport.hardwareAddress();
    }

    public String serialNumber() {
        return transport.serialNumber();
    }

    public synchronized boolean isAlive() {
        return state == State.OPEN && transport.isOpen();
    }

    /** Hạn ghi tính từ lúc tới lượt chạy, không tính thời gian chờ thao tác trước. */
    public CompletableFuture<Void> write(byte[] data, long timeoutMillis) {
        return enqueue(() -> {
            transport.write(data, deadlineAfter(timeoutMillis));
            return null;
        });
    }

    /** Hạn đọc tính từ lúc tới lượt chạy; hết hạn mà chưa có byte thì trả mảng rỗng. */
    public CompletableFuture<byte[]> read(int maxBytes, long timeoutMillis) {
        return enqueue(() -> transport.read(maxBytes, deadlineAfter(timeoutMillis)));
    }

    /** Đóng sau khi các thao tác đã nhận chạy xong; gọi lại trả cùng một future. */
    public synchronized CompletableFuture<Void> close() {
        if (state != State.OPEN) {
            return closeFuture;
        }

        state = State.CLOSING;
        operationExecutor.execute(this::closeTransport);
        operationExecutor.shutdown();
        return closeFuture;
    }

    /** Đóng ngay, không chờ: giải phóng luồng đang kẹt và kết thúc mọi thao tác chưa xong với `CONNECTION_LOST`. */
    public void abort() {
        List<CompletableFuture<?>> waitingOperations;

        synchronized (this) {
            if (state == State.CLOSED || state == State.ABORTED) {
                return;
            }

            state = State.ABORTED;
            waitingOperations = new ArrayList<>(unfinishedOperations);
            waitingOperations.remove(runningOperation);
        }

        transport.close();

        for (CompletableFuture<?> operation : waitingOperations) {
            operation.completeExceptionally(connectionLost(0));
        }

        operationExecutor.shutdown();
        closeFuture.complete(null);
    }

    private <T> CompletableFuture<T> enqueue(IOperation<T> operation) {
        CompletableFuture<T> result = new CompletableFuture<>();

        synchronized (this) {
            if (state != State.OPEN) {
                result.completeExceptionally(notConnected());
                return result;
            }

            unfinishedOperations.add(result);
            operationExecutor.execute(() -> runOperation(operation, result));
        }

        return result;
    }

    private <T> void runOperation(IOperation<T> operation, CompletableFuture<T> result) {
        if (!markRunning(result)) {
            return;
        }

        try {
            succeed(result, operation.run());
        } catch (DeviceException exception) {
            fail(result, exception);
        } catch (RuntimeException exception) {
            result.completeExceptionally(exception);
        } finally {
            markFinished(result);
        }
    }

    private synchronized boolean markRunning(CompletableFuture<?> result) {
        if (result.isDone()) {
            return false;
        }

        runningOperation = result;
        return true;
    }

    private synchronized void markFinished(CompletableFuture<?> result) {
        unfinishedOperations.remove(result);

        if (runningOperation == result) {
            runningOperation = null;
        }
    }

    private synchronized <T> void succeed(CompletableFuture<T> result, T value) {
        if (state == State.ABORTED) {
            result.completeExceptionally(connectionLost(0));
            return;
        }

        result.complete(value);
    }

    private void fail(CompletableFuture<?> result, DeviceException exception) {
        synchronized (this) {
            if (state == State.ABORTED) {
                result.completeExceptionally(connectionLost(exception.bytesWritten()));
                return;
            }

            result.completeExceptionally(exception);
        }

        if (!transport.isOpen()) {
            transportLostHandler.accept(this);
        }
    }

    private void closeTransport() {
        transport.close();

        synchronized (this) {
            if (state == State.CLOSING) {
                state = State.CLOSED;
            }
        }

        closeFuture.complete(null);
    }

    private static long deadlineAfter(long timeoutMillis) {
        return System.currentTimeMillis() + timeoutMillis;
    }

    private DeviceException notConnected() {
        return new DeviceException(DeviceErrorCode.NOT_CONNECTED, "Kết nối đã đóng: " + connectionId);
    }

    private DeviceException connectionLost(int bytesWritten) {
        return new DeviceException(DeviceErrorCode.CONNECTION_LOST, "Mất kết nối: " + connectionId)
                .withBytesWritten(bytesWritten);
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/connection/ConnectionPool.java`**

```java
package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.ConnectedDevice;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DisconnectReason;
import com.ndtcorepos.device.transport.ITransport;
import com.ndtcorepos.device.transport.ITransportFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.function.Supplier;

/** Nơi duy nhất sở hữu các kết nối native đang mở: mở, dùng lại, đóng, xử lý mất kết nối và chen ngang. */
public final class ConnectionPool {

    /** Kết quả giữ chỗ khi kết nối: dùng lại kết nối có sẵn, chờ một việc khác xong, hoặc tự mở. */
    private static final class Reservation {

        private final Connection existing;

        private final CompletableFuture<?> busy;

        private final CompletableFuture<Connection> opening;

        private Reservation(
                Connection existing,
                CompletableFuture<?> busy,
                CompletableFuture<Connection> opening) {
            this.existing = existing;
            this.busy = busy;
            this.opening = opening;
        }

        private static Reservation reuse(Connection existing) {
            return new Reservation(existing, null, null);
        }

        private static Reservation waitFor(CompletableFuture<?> busy) {
            return new Reservation(null, busy, null);
        }

        private static Reservation open(CompletableFuture<Connection> opening) {
            return new Reservation(null, null, opening);
        }
    }

    private final ITransportFactory transportFactory;

    private final IDisconnectListener listener;

    /** Chạy tìm thiết bị + mở transport; được phép chặn (chờ quyền USB, mở socket). */
    private final ExecutorService connectExecutor;

    /** Abort kết nối bị mất ngoài luồng gọi (broadcast chạy trên luồng UI, đóng Bluetooth có thể chờ vài giây). */
    private final ExecutorService abortExecutor;

    /** Tạo luồng riêng cho mỗi kết nối mới. */
    private final Supplier<ExecutorService> operationExecutorFactory;

    private final Object lock = new Object();

    private final Map<String, Connection> openConnections = new HashMap<>();

    /** Kết nối đang đóng do JS gọi `disconnect`. */
    private final Map<String, Connection> closingConnections = new HashMap<>();

    /** Các lần `connect` đang chạy, gộp theo `DeviceAddress.lookupKey()`. */
    private final Map<String, CompletableFuture<ConnectedDevice>> pendingByLookupKey = new HashMap<>();

    /** Thiết bị đang được mở, gộp các địa chỉ khác nhau cùng trỏ một máy. */
    private final Map<String, CompletableFuture<Connection>> openingByConnectionId = new HashMap<>();

    private boolean closed;

    public ConnectionPool(
            ITransportFactory transportFactory,
            IDisconnectListener listener,
            ExecutorService connectExecutor,
            ExecutorService abortExecutor,
            Supplier<ExecutorService> operationExecutorFactory) {
        this.transportFactory = transportFactory;
        this.listener = listener;
        this.connectExecutor = connectExecutor;
        this.abortExecutor = abortExecutor;
        this.operationExecutorFactory = operationExecutorFactory;
    }

    public CompletableFuture<ConnectedDevice> connect(DeviceAddress address) {
        String lookupKey = address.lookupKey();

        synchronized (lock) {
            if (closed) {
                return failedFuture(serviceClosed());
            }

            CompletableFuture<ConnectedDevice> pending = pendingByLookupKey.get(lookupKey);

            if (pending != null) {
                return pending;
            }

            CompletableFuture<ConnectedDevice> result = new CompletableFuture<>();
            pendingByLookupKey.put(lookupKey, result);
            result.whenComplete((connectedDevice, error) -> removePending(lookupKey, result));
            connectExecutor.execute(() -> connectOnWorker(address, result));
            return result;
        }
    }

    public CompletableFuture<Void> write(
            String connectionId,
            byte[] data,
            long timeoutMillis) {
        try {
            return findOpenConnection(connectionId).write(data, timeoutMillis);
        } catch (DeviceException exception) {
            return failedFuture(exception);
        }
    }

    public CompletableFuture<byte[]> read(
            String connectionId,
            int maxBytes,
            long timeoutMillis) {
        try {
            return findOpenConnection(connectionId).read(maxBytes, timeoutMillis);
        } catch (DeviceException exception) {
            return failedFuture(exception);
        }
    }

    /** Đóng sau khi thao tác đã xếp trước chạy xong; không phát sự kiện mất kết nối. */
    public CompletableFuture<Void> disconnect(String connectionId) {
        synchronized (lock) {
            if (closed) {
                return failedFuture(serviceClosed());
            }

            Connection closing = closingConnections.get(connectionId);

            if (closing != null) {
                return closing.close();
            }

            CompletableFuture<Connection> opening = openingByConnectionId.get(connectionId);

            if (opening != null) {
                return opening.handle((connection, error) -> null).thenCompose(ignored -> disconnect(connectionId));
            }

            return closeOpenConnection(connectionId);
        }
    }

    /** Monitor báo một thiết bị vật lý đã mất. */
    public void onHardwareLost(String hardwareAddress, DisconnectReason reason) {
        Connection lostConnection = findByHardwareAddress(hardwareAddress);

        if (lostConnection != null) {
            loseConnection(lostConnection, reason);
        }
    }

    /** Abort mọi kết nối, không chờ, không phát sự kiện; mọi lời gọi sau đó bị từ chối. */
    public void closeAll() {
        List<Connection> connectionsToAbort;

        synchronized (lock) {
            if (closed) {
                return;
            }

            closed = true;
            connectionsToAbort = new ArrayList<>(openConnections.values());
            connectionsToAbort.addAll(closingConnections.values());
            openConnections.clear();
            closingConnections.clear();
            connectExecutor.shutdown();
            abortExecutor.shutdown();
        }

        for (Connection connection : connectionsToAbort) {
            connection.abort();
        }
    }

    private void connectOnWorker(DeviceAddress address, CompletableFuture<ConnectedDevice> result) {
        try {
            ITransport transport = transportFactory.create(address);
            String connectionId = address.type().wireValue() + ":" + transport.hardwareAddress();
            Connection connection = acquireConnection(connectionId, transport);
            result.complete(new ConnectedDevice(connectionId, connection.serialNumber()));
        } catch (DeviceException | RuntimeException exception) {
            result.completeExceptionally(exception);
        }
    }

    /** Dùng lại kết nối đang mở cùng thiết bị, chờ lần mở/đóng khác xong, hoặc tự mở. */
    private Connection acquireConnection(String connectionId, ITransport transport) throws DeviceException {
        while (true) {
            Reservation reservation = reserve(connectionId, transport);

            if (reservation.existing != null) {
                transport.close();
                return reservation.existing;
            }

            if (reservation.opening != null) {
                return openReserved(connectionId, transport, reservation.opening);
            }

            awaitQuietly(reservation.busy);
        }
    }

    private Reservation reserve(String connectionId, ITransport transport) throws DeviceException {
        synchronized (lock) {
            throwIfClosed(transport);
            Connection existing = openConnections.get(connectionId);

            if (existing != null && existing.isAlive()) {
                return Reservation.reuse(existing);
            }

            discardDeadConnection(connectionId, existing);
            CompletableFuture<?> busy = busyFuture(connectionId);

            if (busy != null) {
                return Reservation.waitFor(busy);
            }

            CompletableFuture<Connection> opening = new CompletableFuture<>();
            openingByConnectionId.put(connectionId, opening);
            return Reservation.open(opening);
        }
    }

    /** Gỡ khỏi danh sách đang mở trước khi hoàn tất future, vì callback của bên chờ chạy ngay khi future hoàn tất. */
    private Connection openReserved(
            String connectionId,
            ITransport transport,
            CompletableFuture<Connection> opening) throws DeviceException {
        Connection connection;

        try {
            connection = openAndPublish(connectionId, transport);
        } catch (DeviceException | RuntimeException exception) {
            transport.close();
            removeOpening(connectionId, opening);
            opening.completeExceptionally(exception);
            throw exception;
        }

        removeOpening(connectionId, opening);
        opening.complete(connection);
        return connection;
    }

    private Connection openAndPublish(String connectionId, ITransport transport) throws DeviceException {
        transport.open();
        Connection connection = new Connection(
                connectionId,
                transport,
                operationExecutorFactory.get(),
                this::onTransportLost);
        publish(connection);
        return connection;
    }

    /** Đưa kết nối vào pool; pool đã đóng thì huỷ ngay để không bao giờ thêm kết nối sau `closeAll`. */
    private void publish(Connection connection) throws DeviceException {
        synchronized (lock) {
            if (!closed) {
                openConnections.put(connection.connectionId(), connection);
                return;
            }
        }

        connection.abort();
        throw serviceClosed();
    }

    private CompletableFuture<Void> closeOpenConnection(String connectionId) {
        Connection connection = openConnections.remove(connectionId);

        if (connection == null) {
            return CompletableFuture.completedFuture(null);
        }

        closingConnections.put(connectionId, connection);
        CompletableFuture<Void> closeFuture = connection.close();
        closeFuture.whenComplete((ignored, error) -> removeClosing(connectionId, connection));
        return closeFuture;
    }

    private void onTransportLost(Connection connection) {
        loseConnection(connection, DisconnectReason.IO_ERROR);
    }

    /** Nơi duy nhất chuyển một kết nối sang "mất": chỉ lần bỏ khỏi pool đầu tiên thành công mới báo và abort. */
    private void loseConnection(Connection connection, DisconnectReason reason) {
        synchronized (lock) {
            if (!openConnections.remove(connection.connectionId(), connection)) {
                return;
            }

            abortExecutor.execute(connection::abort);
        }

        listener.onDisconnected(connection.connectionId(), reason);
    }

    private Connection findByHardwareAddress(String hardwareAddress) {
        synchronized (lock) {
            for (Connection connection : openConnections.values()) {
                if (connection.hardwareAddress().equalsIgnoreCase(hardwareAddress)) {
                    return connection;
                }
            }

            return null;
        }
    }

    private Connection findOpenConnection(String connectionId) throws DeviceException {
        synchronized (lock) {
            if (closed) {
                throw serviceClosed();
            }

            Connection connection = openConnections.get(connectionId);

            if (connection == null) {
                throw new DeviceException(DeviceErrorCode.NOT_CONNECTED, "Chưa kết nối: " + connectionId);
            }

            return connection;
        }
    }

    /** Kết nối còn trong pool nhưng transport đã chết: bỏ đi không phát sự kiện, để mở lại. */
    private void discardDeadConnection(String connectionId, Connection deadConnection) {
        if (deadConnection == null) {
            return;
        }

        openConnections.remove(connectionId);
        abortExecutor.execute(deadConnection::abort);
    }

    private CompletableFuture<?> busyFuture(String connectionId) {
        Connection closing = closingConnections.get(connectionId);

        if (closing != null) {
            return closing.close();
        }

        return openingByConnectionId.get(connectionId);
    }

    private void throwIfClosed(ITransport transport) throws DeviceException {
        if (closed) {
            transport.close();
            throw serviceClosed();
        }
    }

    private void removePending(String lookupKey, CompletableFuture<ConnectedDevice> pending) {
        synchronized (lock) {
            pendingByLookupKey.remove(lookupKey, pending);
        }
    }

    private void removeOpening(String connectionId, CompletableFuture<Connection> opening) {
        synchronized (lock) {
            openingByConnectionId.remove(connectionId, opening);
        }
    }

    private void removeClosing(String connectionId, Connection connection) {
        synchronized (lock) {
            closingConnections.remove(connectionId, connection);
        }
    }

    private static void awaitQuietly(CompletableFuture<?> future) {
        try {
            future.join();
        } catch (CompletionException ignored) {
            // Việc mở/đóng kia lỗi thì vòng giữ chỗ tiếp theo tự xử lý lại từ đầu.
        }
    }

    private static DeviceException serviceClosed() {
        return new DeviceException(DeviceErrorCode.SERVICE_CLOSED, "Dịch vụ thiết bị đã đóng");
    }

    private static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }
}
```

- [ ] **Step 4: Chạy test 3 lần, mong đợi PASS cả 3** — `for i in 1 2 3; do cd android && ./gradlew :app:cleanTestDebugUnitTest :app:testDebugUnitTest --tests "com.ndtcorepos.device.connection.*" -q || break; cd ..; done` → 24 test pass mỗi lần (test có chạy đua, phải ổn định).

- [ ] **Step 5: Kiểm quy ước** — `node check-style.js android/app/src/main/java/com/ndtcorepos android/app/src/test/java/com/ndtcorepos` → không in gì.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/device/transport/ITransport.java
git add android/app/src/main/java/com/ndtcorepos/device/transport/ITransportFactory.java
git add android/app/src/main/java/com/ndtcorepos/device/connection/IDisconnectListener.java
git add android/app/src/main/java/com/ndtcorepos/device/connection/Connection.java
git add android/app/src/main/java/com/ndtcorepos/device/connection/ConnectionPool.java
git add android/app/src/test/java/com/ndtcorepos/device/connection/FakeTransport.java
git add android/app/src/test/java/com/ndtcorepos/device/connection/FakeTransportFactory.java
git add android/app/src/test/java/com/ndtcorepos/device/connection/Futures.java
git add android/app/src/test/java/com/ndtcorepos/device/connection/ConnectionTest.java
git add android/app/src/test/java/com/ndtcorepos/device/connection/ConnectionPoolTest.java
git commit -m "feat: add connection pool with serialized I/O and loss handling" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Tìm thiết bị và xin quyền USB

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/device/permission/UsbPermission.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/discovery/IDeviceDiscovery.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/discovery/UsbDiscovery.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/discovery/BluetoothDiscovery.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/discovery/UsbDiscoveryTest.java`

**Interfaces:**
- Consumes (Task 1): `DeviceAddress`, `DeviceInfo`, `DeviceException`.
- Produces: `UsbPermission(Context, UsbManager)` với `hasPermission(UsbDevice)`, `request(UsbDevice)` (chặn ≤ 30 s); `IDeviceDiscovery.discover()`; `UsbDiscovery(UsbManager, UsbPermission)` với `discover()`, `find(DeviceAddress)`, static `chooseCandidate(...)`, `findPrinterInterface(UsbDevice)`, `findBulkEndpoint(UsbInterface, direction)`; `BluetoothDiscovery(Context)` với `discover()`, `findBonded(mac)`.

- [ ] **Step 1: Viết test**

**File: `android/app/src/test/java/com/ndtcorepos/device/discovery/UsbDiscoveryTest.java`**

```java
package com.ndtcorepos.device.discovery;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class UsbDiscoveryTest {

    /** Ứng viên giả thay cho `UsbDevice`: đường dẫn thiết bị và serial đọc được sau khi có quyền. */
    private static final class Candidate {

        private final String devicePath;

        private final String serialNumber;

        private Candidate(String devicePath, String serialNumber) {
            this.devicePath = devicePath;
            this.serialNumber = serialNumber;
        }
    }

    private final Candidate first = new Candidate("/dev/bus/usb/001/004", "SN-A");

    private final Candidate second = new Candidate("/dev/bus/usb/001/005", "SN-B");

    @Test
    public void noCandidateIsDeviceNotFound() {
        assertFailure(DeviceErrorCode.DEVICE_NOT_FOUND, Collections.emptyList(), null, null);
    }

    @Test
    public void serialPicksMatchingCandidate() throws Exception {
        assertSame(second, choose(Arrays.asList(first, second), "SN-B", null));
    }

    @Test
    public void unmatchedSerialIsDeviceNotFoundEvenWhenPathMatches() {
        assertFailure(DeviceErrorCode.DEVICE_NOT_FOUND, Arrays.asList(first, second), "SN-X", first.devicePath);
    }

    @Test
    public void withoutSerialDevicePathPicksCandidate() throws Exception {
        assertSame(second, choose(Arrays.asList(first, second), null, second.devicePath));
    }

    @Test
    public void withoutSerialSingleCandidateIsChosen() throws Exception {
        assertSame(first, choose(Collections.singletonList(first), null, "/dev/bus/usb/009/009"));
    }

    @Test
    public void withoutSerialManyCandidatesIsAmbiguous() {
        assertFailure(DeviceErrorCode.AMBIGUOUS_DEVICE, Arrays.asList(first, second), null, null);
        assertFailure(DeviceErrorCode.AMBIGUOUS_DEVICE, Arrays.asList(first, second), null, "/dev/bus/usb/009/009");
    }

    @Test
    public void serialReaderFailurePropagates() {
        try {
            UsbDiscovery.chooseCandidate(
                    Collections.singletonList(first),
                    "SN-A",
                    null,
                    candidate -> {
                        throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "từ chối");
                    },
                    candidate -> candidate.devicePath);
            fail("Mong đợi lỗi");
        } catch (DeviceException exception) {
            assertEquals(DeviceErrorCode.PERMISSION_DENIED, exception.errorCode());
        }
    }

    private static Candidate choose(
            List<Candidate> candidates,
            String serial,
            String devicePath) throws Exception {
        return UsbDiscovery.chooseCandidate(
                candidates,
                serial,
                devicePath,
                candidate -> candidate.serialNumber,
                candidate -> candidate.devicePath);
    }

    private static void assertFailure(
            DeviceErrorCode expected,
            List<Candidate> candidates,
            String serial,
            String devicePath) {
        try {
            choose(candidates, serial, devicePath);
            fail("Mong đợi lỗi " + expected);
        } catch (DeviceException exception) {
            assertEquals(expected, exception.errorCode());
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}
```

- [ ] **Step 2: Chạy test, mong đợi FAIL** — `cd android && ./gradlew :app:testDebugUnitTest --tests "com.ndtcorepos.device.discovery.*" -q` → lỗi compile (thiếu `UsbDiscovery`).

- [ ] **Step 3: Viết code**

**File: `android/app/src/main/java/com/ndtcorepos/device/permission/UsbPermission.java`**

```java
package com.ndtcorepos.device.permission;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;

import androidx.core.content.ContextCompat;
import androidx.core.content.IntentCompat;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Hỏi người dùng cho phép app dùng một thiết bị USB và chờ câu trả lời. */
public final class UsbPermission {

    private static final String ACTION_USB_PERMISSION = "com.ndtcorepos.device.USB_PERMISSION";

    private static final long PERMISSION_TIMEOUT_MS = 30_000;

    private static final int PERMISSION_REQUEST_CODE = 0;

    private final Context context;

    private final UsbManager usbManager;

    public UsbPermission(Context context, UsbManager usbManager) {
        this.context = context;
        this.usbManager = usbManager;
    }

    public boolean hasPermission(UsbDevice device) {
        return usbManager.hasPermission(device);
    }

    /**
     * Hiện hộp thoại xin quyền USB của Android và chặn luồng gọi tới khi người dùng trả lời (tối đa 30 giây).
     * Rút thiết bị khi hộp thoại đang mở được coi là từ chối.
     */
    public void request(UsbDevice device) throws DeviceException {
        if (hasPermission(device)) {
            return;
        }

        CompletableFuture<Boolean> answer = new CompletableFuture<>();
        BroadcastReceiver receiver = createAnswerReceiver(device, answer);
        ContextCompat.registerReceiver(context, receiver, createAnswerFilter(), ContextCompat.RECEIVER_NOT_EXPORTED);

        try {
            usbManager.requestPermission(device, createPermissionIntent());

            if (!awaitAnswer(answer)) {
                throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "Không được cấp quyền USB");
            }
        } finally {
            context.unregisterReceiver(receiver);
        }
    }

    private static BroadcastReceiver createAnswerReceiver(UsbDevice device, CompletableFuture<Boolean> answer) {
        return new BroadcastReceiver() {
            @Override
            public void onReceive(Context receiverContext, Intent intent) {
                UsbDevice eventDevice = IntentCompat.getParcelableExtra(
                        intent,
                        UsbManager.EXTRA_DEVICE,
                        UsbDevice.class);

                if (eventDevice == null || !eventDevice.getDeviceName().equals(device.getDeviceName())) {
                    return;
                }

                answer.complete(isGranted(intent));
            }
        };
    }

    private static boolean isGranted(Intent intent) {
        if (!ACTION_USB_PERMISSION.equals(intent.getAction())) {
            return false;
        }

        return intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
    }

    private static IntentFilter createAnswerFilter() {
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        return filter;
    }

    /** Hệ thống gắn kết quả vào intent nên từ Android 12 PendingIntent phải mutable; intent gắn package của app. */
    private PendingIntent createPermissionIntent() {
        Intent intent = new Intent(ACTION_USB_PERMISSION).setPackage(context.getPackageName());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        return PendingIntent.getBroadcast(context, PERMISSION_REQUEST_CODE, intent, flags);
    }

    private static boolean awaitAnswer(CompletableFuture<Boolean> answer) {
        try {
            return answer.get(PERMISSION_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        } catch (ExecutionException | TimeoutException exception) {
            return false;
        }
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/discovery/IDeviceDiscovery.java`**

```java
package com.ndtcorepos.device.discovery;

import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceInfo;

import java.util.List;

/** Liệt kê thiết bị của một loại đường truyền. */
public interface IDeviceDiscovery {

    List<DeviceInfo> discover() throws DeviceException;
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/discovery/UsbDiscovery.java`**

```java
package com.ndtcorepos.device.discovery;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;
import com.ndtcorepos.device.permission.UsbPermission;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/** Liệt kê thiết bị USB có thể nhận dữ liệu in và tìm đúng thiết bị cho một địa chỉ USB. */
public final class UsbDiscovery implements IDeviceDiscovery {

    /** Đọc serial của một ứng viên, xin quyền nếu cần. */
    public interface ISerialReader<T> {
        String readSerial(T candidate) throws DeviceException;
    }

    private final UsbManager usbManager;

    private final UsbPermission usbPermission;

    public UsbDiscovery(UsbManager usbManager, UsbPermission usbPermission) {
        this.usbManager = usbManager;
        this.usbPermission = usbPermission;
    }

    /** Không mở hộp thoại xin quyền; thiết bị chưa có quyền trả serial `null`. */
    @Override
    public List<DeviceInfo> discover() throws DeviceException {
        List<DeviceInfo> devices = new ArrayList<>();

        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (findPrinterInterface(device) != null) {
                devices.add(toDeviceInfo(device));
            }
        }

        return devices;
    }

    /** Có thể hiện hộp thoại xin quyền và chặn luồng gọi nên chỉ gọi từ luồng mở kết nối. */
    public UsbDevice find(DeviceAddress address) throws DeviceException {
        UsbDevice device = chooseCandidate(
                candidatesFor(address),
                address.serialNumber(),
                address.devicePath(),
                this::readSerialWithPermission,
                UsbDevice::getDeviceName);
        usbPermission.request(device);
        return device;
    }

    /**
     * Luật chọn: có serial thì phải khớp serial; không có serial thì khớp `devicePath`; còn lại chỉ chọn khi có đúng
     * một ứng viên. Không bao giờ âm thầm chọn máy đầu tiên.
     */
    public static <T> T chooseCandidate(
            List<T> candidates,
            String targetSerial,
            String targetDevicePath,
            ISerialReader<T> serialReader,
            Function<T, String> devicePathOf) throws DeviceException {
        if (candidates.isEmpty()) {
            throw new DeviceException(DeviceErrorCode.DEVICE_NOT_FOUND, "Không thấy thiết bị USB");
        }

        if (targetSerial != null) {
            return chooseBySerial(candidates, targetSerial, serialReader);
        }

        T byDevicePath = findByDevicePath(candidates, targetDevicePath, devicePathOf);

        if (byDevicePath != null) {
            return byDevicePath;
        }

        if (candidates.size() == 1) {
            return candidates.get(0);
        }

        throw new DeviceException(DeviceErrorCode.AMBIGUOUS_DEVICE, "Nhiều máy USB cùng loại, cần serial để phân biệt");
    }

    /** Interface đầu tiên có endpoint bulk OUT; thiết bị gộp nhiều chức năng có thể có interface HID đứng trước. */
    public static UsbInterface findPrinterInterface(UsbDevice device) {
        for (int index = 0; index < device.getInterfaceCount(); index++) {
            UsbInterface usbInterface = device.getInterface(index);

            if (findBulkEndpoint(usbInterface, UsbConstants.USB_DIR_OUT) != null) {
                return usbInterface;
            }
        }

        return null;
    }

    public static UsbEndpoint findBulkEndpoint(UsbInterface usbInterface, int direction) {
        for (int index = 0; index < usbInterface.getEndpointCount(); index++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(index);

            if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.getDirection() == direction) {
                return endpoint;
            }
        }

        return null;
    }

    private static <T> T chooseBySerial(
            List<T> candidates,
            String targetSerial,
            ISerialReader<T> serialReader) throws DeviceException {
        for (T candidate : candidates) {
            if (targetSerial.equals(serialReader.readSerial(candidate))) {
                return candidate;
            }
        }

        throw new DeviceException(DeviceErrorCode.DEVICE_NOT_FOUND, "Không thấy máy USB có serial " + targetSerial);
    }

    private static <T> T findByDevicePath(
            List<T> candidates,
            String targetDevicePath,
            Function<T, String> devicePathOf) {
        if (targetDevicePath == null) {
            return null;
        }

        for (T candidate : candidates) {
            if (targetDevicePath.equals(devicePathOf.apply(candidate))) {
                return candidate;
            }
        }

        return null;
    }

    /** Ứng viên cùng vendorId/productId có bulk OUT; thiết bị đã có quyền xếp trước để hạn chế hộp thoại. */
    private List<UsbDevice> candidatesFor(DeviceAddress address) {
        List<UsbDevice> permitted = new ArrayList<>();
        List<UsbDevice> notPermitted = new ArrayList<>();

        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (!matchesIds(device, address) || findPrinterInterface(device) == null) {
                continue;
            }

            List<UsbDevice> group = usbPermission.hasPermission(device) ? permitted : notPermitted;
            group.add(device);
        }

        permitted.addAll(notPermitted);
        return permitted;
    }

    private static boolean matchesIds(UsbDevice device, DeviceAddress address) {
        return device.getVendorId() == address.vendorId() && device.getProductId() == address.productId();
    }

    private String readSerialWithPermission(UsbDevice device) throws DeviceException {
        usbPermission.request(device);
        return readSerial(device);
    }

    private DeviceInfo toDeviceInfo(UsbDevice device) throws DeviceException {
        boolean hasPermission = usbPermission.hasPermission(device);
        String serialNumber = hasPermission ? readSerial(device) : null;
        DeviceAddress address = DeviceAddress.usb(
                device.getVendorId(),
                device.getProductId(),
                serialNumber,
                device.getDeviceName());
        String name = device.getProductName() != null ? device.getProductName() : device.getDeviceName();
        return DeviceInfo.usb(
                "usb:" + device.getDeviceName(),
                name,
                address,
                device.getManufacturerName(),
                device.getProductName(),
                hasPermission);
    }

    /** Từ Android 10, đọc serial khi chưa có quyền USB ném SecurityException. */
    private static String readSerial(UsbDevice device) {
        try {
            return device.getSerialNumber();
        } catch (SecurityException exception) {
            return null;
        }
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/discovery/BluetoothDiscovery.java`**

```java
package com.ndtcorepos.device.discovery;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.Context;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Liệt kê thiết bị Bluetooth đã ghép đôi và tìm thiết bị theo MAC. Quyền Bluetooth do TS xin. */
public final class BluetoothDiscovery implements IDeviceDiscovery {

    private final Context context;

    public BluetoothDiscovery(Context context) {
        this.context = context;
    }

    @Override
    public List<DeviceInfo> discover() throws DeviceException {
        List<DeviceInfo> devices = new ArrayList<>();

        for (BluetoothDevice device : bondedDevices()) {
            devices.add(toDeviceInfo(device));
        }

        return devices;
    }

    public BluetoothDevice findBonded(String mac) throws DeviceException {
        for (BluetoothDevice device : bondedDevices()) {
            if (device.getAddress().equalsIgnoreCase(mac)) {
                return device;
            }
        }

        throw new DeviceException(
                DeviceErrorCode.DEVICE_NOT_FOUND,
                "Không thấy thiết bị Bluetooth đã ghép đôi: " + mac);
    }

    /** Thiết bị đã ghép đôi qua BluetoothAdapter; từ Android 12 cần quyền BLUETOOTH_CONNECT. */
    private Set<BluetoothDevice> bondedDevices() throws DeviceException {
        BluetoothAdapter adapter = requireEnabledAdapter();

        try {
            return adapter.getBondedDevices();
        } catch (SecurityException exception) {
            throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "Thiếu quyền Bluetooth", exception);
        }
    }

    private BluetoothAdapter requireEnabledAdapter() throws DeviceException {
        BluetoothManager manager = context.getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();

        if (adapter == null || !adapter.isEnabled()) {
            throw new DeviceException(DeviceErrorCode.BLUETOOTH_DISABLED, "Bluetooth đang tắt hoặc không có");
        }

        return adapter;
    }

    private static DeviceInfo toDeviceInfo(BluetoothDevice device) throws DeviceException {
        DeviceAddress address = DeviceAddress.bluetooth(device.getAddress());
        return DeviceInfo.bluetooth("bluetooth:" + address.mac(), readName(device), address);
    }

    /** Từ Android 12, đọc tên khi thiếu quyền BLUETOOTH_CONNECT ném SecurityException. */
    private static String readName(BluetoothDevice device) {
        try {
            return device.getName();
        } catch (SecurityException exception) {
            return null;
        }
    }
}
```

- [ ] **Step 4: Chạy test, mong đợi PASS** — cùng lệnh Step 2 → 7 test pass.

- [ ] **Step 5: Kiểm quy ước** — như Task 1.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/device/permission/UsbPermission.java
git add android/app/src/main/java/com/ndtcorepos/device/discovery/IDeviceDiscovery.java
git add android/app/src/main/java/com/ndtcorepos/device/discovery/UsbDiscovery.java
git add android/app/src/main/java/com/ndtcorepos/device/discovery/BluetoothDiscovery.java
git add android/app/src/test/java/com/ndtcorepos/device/discovery/UsbDiscoveryTest.java
git commit -m "feat: add USB/Bluetooth discovery and USB permission request" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Transport USB, Bluetooth, LAN

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/device/transport/StreamWriter.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/transport/UsbTransport.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/transport/BluetoothTransport.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/transport/LanTransport.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/transport/TransportFactory.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/transport/StreamWriterTest.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/transport/UsbTransportTest.java`

**Interfaces:**
- Consumes: `ITransport`, `ITransportFactory` (Task 2); `UsbDiscovery.find/findPrinterInterface/findBulkEndpoint`, `BluetoothDiscovery.findBonded` (Task 3); `DeviceAddress`, `DeviceException` (Task 1).
- Produces: `StreamWriter.writeAll(stream, connection, data, deadlineMillis, timer)`; `UsbTransport(UsbManager, UsbDevice)` + static `writeInChunks(data, deadlineMillis, IChunkWriter)`; `BluetoothTransport(BluetoothDevice, timer)`; `LanTransport(host, port, timer)`; `TransportFactory(UsbManager, UsbDiscovery, BluetoothDiscovery, ScheduledExecutorService)`.

- [ ] **Step 1: Viết test**

**File: `android/app/src/test/java/com/ndtcorepos/device/transport/StreamWriterTest.java`**

```java
package com.ndtcorepos.device.transport;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.Closeable;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

public class StreamWriterTest {

    private static final long LONG_DEADLINE_MS = 5_000;

    private static final long SHORT_DEADLINE_MS = 200;

    private static final long AFTER_DEADLINE_MS = 400;

    private static final int NEVER = -1;

    /** Stream giả ghi lại kích thước từng khúc; có thể chặn ở một khúc tới khi bị đóng, hoặc lỗi ở một khúc. */
    private static final class RecordingStream extends OutputStream implements Closeable {

        private final List<Integer> chunkSizes = new CopyOnWriteArrayList<>();

        private volatile int blockAtChunk = NEVER;

        private volatile int failAtChunk = NEVER;

        private volatile boolean closed;

        @Override
        public void write(int value) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void write(
                byte[] buffer,
                int offset,
                int length) throws IOException {
            int chunkIndex = chunkSizes.size();
            waitWhileBlocked(chunkIndex);

            if (closed || chunkIndex == failAtChunk) {
                throw new IOException("stream lỗi");
            }

            chunkSizes.add(length);
        }

        @Override
        public void close() {
            closed = true;
        }

        private void waitWhileBlocked(int chunkIndex) {
            while (chunkIndex == blockAtChunk && !closed) {
                Thread.yield();
            }
        }
    }

    private final RecordingStream stream = new RecordingStream();

    private ScheduledExecutorService timer;

    @Before
    public void setUp() {
        timer = Executors.newSingleThreadScheduledExecutor();
    }

    @After
    public void tearDown() {
        timer.shutdownNow();
    }

    @Test
    public void writesInChunksOfFourKilobytes() throws Exception {
        StreamWriter.writeAll(stream, stream, new byte[10_000], deadlineIn(LONG_DEADLINE_MS), timer);

        assertEquals(Arrays.asList(4_096, 4_096, 1_808), stream.chunkSizes);
    }

    @Test
    public void deadlineClosesConnectionAndReportsBytesSent() {
        stream.blockAtChunk = 1;

        DeviceException failure = writeExpectingFailure(new byte[10_000], deadlineIn(SHORT_DEADLINE_MS));

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(4_096, failure.bytesWritten());
        assertTrue(stream.closed);
    }

    @Test
    public void finishedWriteIsNeverReportedAsTimeout() throws Exception {
        StreamWriter.writeAll(stream, stream, new byte[100], deadlineIn(SHORT_DEADLINE_MS), timer);
        Thread.sleep(AFTER_DEADLINE_MS);

        assertFalse(stream.closed);
    }

    @Test
    public void ioErrorIsWriteFailedWithBytesSent() {
        stream.failAtChunk = 2;

        DeviceException failure = writeExpectingFailure(new byte[10_000], deadlineIn(LONG_DEADLINE_MS));

        assertEquals(DeviceErrorCode.WRITE_FAILED, failure.errorCode());
        assertEquals(8_192, failure.bytesWritten());
    }

    @Test
    public void expiredDeadlineTimesOutBeforeAnyByte() {
        stream.blockAtChunk = 0;

        DeviceException failure = writeExpectingFailure(new byte[10], System.currentTimeMillis() - 1);

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(0, failure.bytesWritten());
    }

    private DeviceException writeExpectingFailure(byte[] data, long deadlineMillis) {
        try {
            StreamWriter.writeAll(stream, stream, data, deadlineMillis, timer);
        } catch (DeviceException exception) {
            return exception;
        }

        fail("Mong đợi lỗi khi ghi");
        return null;
    }

    private static long deadlineIn(long millis) {
        return System.currentTimeMillis() + millis;
    }
}
```

**File: `android/app/src/test/java/com/ndtcorepos/device/transport/UsbTransportTest.java`**

```java
package com.ndtcorepos.device.transport;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class UsbTransportTest {

    private static final long LONG_DEADLINE_MS = 5_000;

    private static final long SHORT_DEADLINE_MS = 50;

    private static final long SLOW_TRANSFER_MS = 100;

    private static final int PARTIAL_TRANSFER_BYTES = 1_000;

    private final List<Integer> chunkLengths = new ArrayList<>();

    @Test
    public void splitsIntoSixteenKilobyteChunks() throws Exception {
        UsbTransport.writeInChunks(new byte[40_960], deadlineIn(LONG_DEADLINE_MS), this::acceptAll);

        assertEquals(Arrays.asList(16_384, 16_384, 8_192), chunkLengths);
    }

    @Test
    public void continuesAfterPartialTransfers() throws Exception {
        UsbTransport.writeInChunks(new byte[5_000], deadlineIn(LONG_DEADLINE_MS), this::acceptPartially);

        assertEquals(5, chunkLengths.size());
    }

    @Test
    public void failedTransferAfterDeadlineIsTimeoutWithBytesWritten() {
        DeviceException failure = writeExpectingFailure(deadlineIn(SHORT_DEADLINE_MS), this::failSecondChunkSlowly);

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(16_384, failure.bytesWritten());
    }

    @Test
    public void failedTransferBeforeDeadlineIsWriteFailed() {
        DeviceException failure = writeExpectingFailure(deadlineIn(LONG_DEADLINE_MS), this::failSecondChunk);

        assertEquals(DeviceErrorCode.WRITE_FAILED, failure.errorCode());
        assertEquals(16_384, failure.bytesWritten());
    }

    @Test
    public void expiredDeadlineTimesOutWithoutTransferring() {
        DeviceException failure = writeExpectingFailure(System.currentTimeMillis() - 1, this::acceptAll);

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(0, failure.bytesWritten());
        assertTrue(chunkLengths.isEmpty());
    }

    private int acceptAll(
            byte[] buffer,
            int offset,
            int length,
            int timeoutMillis) {
        chunkLengths.add(length);
        return length;
    }

    private int acceptPartially(
            byte[] buffer,
            int offset,
            int length,
            int timeoutMillis) {
        chunkLengths.add(length);
        return Math.min(length, PARTIAL_TRANSFER_BYTES);
    }

    private int failSecondChunk(
            byte[] buffer,
            int offset,
            int length,
            int timeoutMillis) {
        chunkLengths.add(length);
        return chunkLengths.size() == 1 ? length : -1;
    }

    private int failSecondChunkSlowly(
            byte[] buffer,
            int offset,
            int length,
            int timeoutMillis) {
        if (chunkLengths.size() == 1) {
            sleepQuietly(SLOW_TRANSFER_MS);
        }

        return failSecondChunk(buffer, offset, length, timeoutMillis);
    }

    private DeviceException writeExpectingFailure(long deadlineMillis, UsbTransport.IChunkWriter chunkWriter) {
        try {
            UsbTransport.writeInChunks(new byte[40_960], deadlineMillis, chunkWriter);
        } catch (DeviceException exception) {
            return exception;
        }

        fail("Mong đợi lỗi khi ghi");
        return null;
    }

    private static long deadlineIn(long millis) {
        return System.currentTimeMillis() + millis;
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
```

- [ ] **Step 2: Chạy test, mong đợi FAIL** — `cd android && ./gradlew :app:testDebugUnitTest --tests "com.ndtcorepos.device.transport.*" -q` → lỗi compile.

- [ ] **Step 3: Viết code**

**File: `android/app/src/main/java/com/ndtcorepos/device/transport/StreamWriter.java`**

```java
package com.ndtcorepos.device.transport;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.io.Closeable;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Ghi vào một stream không có timeout ghi (socket Bluetooth/TCP) theo khúc, đúng hạn và đếm được số byte đã gửi.
 * Quá hạn thì đóng kết nối để cắt lần ghi đang kẹt.
 */
public final class StreamWriter {

    private static final int STREAM_CHUNK_SIZE_BYTES = 4_096;

    /** Tiến độ một lần ghi; trạng thái đổi bằng compare-and-set để "ghi xong" và "hết hạn" chỉ một bên thắng. */
    private static final class WriteProgress {

        private static final int RUNNING = 0;

        private static final int FINISHED = 1;

        private static final int TIMED_OUT = 2;

        private final AtomicInteger state = new AtomicInteger(RUNNING);

        private volatile int bytesWritten;

        private boolean markFinished() {
            return state.compareAndSet(RUNNING, FINISHED);
        }

        private boolean markTimedOut() {
            return state.compareAndSet(RUNNING, TIMED_OUT);
        }
    }

    private StreamWriter() {
    }

    public static void writeAll(
            OutputStream stream,
            Closeable connection,
            byte[] data,
            long deadlineMillis,
            ScheduledExecutorService timer) throws DeviceException {
        WriteProgress progress = new WriteProgress();
        long delayMillis = Math.max(0, deadlineMillis - System.currentTimeMillis());
        ScheduledFuture<?> alarm = timer.schedule(
                () -> closeOnTimeout(progress, connection),
                delayMillis,
                TimeUnit.MILLISECONDS);

        try {
            writeChunks(stream, data, progress);
        } catch (IOException exception) {
            throw failure(progress, exception);
        } finally {
            alarm.cancel(false);
        }

        if (!progress.markFinished()) {
            throw timeout(progress);
        }
    }

    private static void writeChunks(
            OutputStream stream,
            byte[] data,
            WriteProgress progress) throws IOException {
        for (int offset = 0; offset < data.length; offset += STREAM_CHUNK_SIZE_BYTES) {
            int length = Math.min(STREAM_CHUNK_SIZE_BYTES, data.length - offset);
            stream.write(data, offset, length);
            stream.flush();
            progress.bytesWritten += length;
        }
    }

    private static void closeOnTimeout(WriteProgress progress, Closeable connection) {
        if (!progress.markTimedOut()) {
            return;
        }

        try {
            connection.close();
        } catch (IOException ignored) {
            // Đóng để cắt lần ghi đang kẹt; đóng lỗi thì lần ghi vẫn kết thúc khi hệ điều hành huỷ socket.
        }
    }

    private static DeviceException failure(WriteProgress progress, IOException cause) {
        if (!progress.markFinished()) {
            return timeout(progress);
        }

        return new DeviceException(DeviceErrorCode.WRITE_FAILED, "Ghi thất bại", cause)
                .withBytesWritten(progress.bytesWritten);
    }

    private static DeviceException timeout(WriteProgress progress) {
        return new DeviceException(DeviceErrorCode.WRITE_TIMEOUT, "Hết hạn khi đang ghi")
                .withBytesWritten(progress.bytesWritten);
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/transport/UsbTransport.java`**

```java
package com.ndtcorepos.device.transport;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.device.discovery.UsbDiscovery;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.util.Arrays;

/** Truyền byte qua USB bằng bulk transfer. */
public final class UsbTransport implements ITransport {

    /** Một lần bulkTransfer lớn hơn mức này bị một số kernel Android từ chối ngay. */
    private static final int USB_CHUNK_SIZE_BYTES = 16_384;

    /** Ghi một khúc; trả số byte đã chuyển, âm khi lỗi hoặc hết thời gian. */
    public interface IChunkWriter {
        int write(
                byte[] buffer,
                int offset,
                int length,
                int timeoutMillis);
    }

    private final UsbManager usbManager;

    private final UsbDevice device;

    private volatile UsbDeviceConnection deviceConnection;

    private volatile UsbInterface claimedInterface;

    private volatile UsbEndpoint outEndpoint;

    /** `null` khi máy in không có endpoint đọc. */
    private volatile UsbEndpoint inEndpoint;

    private volatile String serialNumber;

    public UsbTransport(UsbManager usbManager, UsbDevice device) {
        this.usbManager = usbManager;
        this.device = device;
    }

    /** Mở thiết bị và chiếm interface in qua UsbManager; force để giành lại interface từ driver kernel nếu có. */
    @Override
    public synchronized void open() throws DeviceException {
        UsbInterface printerInterface = UsbDiscovery.findPrinterInterface(device);
        UsbDeviceConnection connection = printerInterface == null ? null : usbManager.openDevice(device);

        if (connection == null) {
            throw new DeviceException(DeviceErrorCode.CONNECTION_FAILED, "Không mở được thiết bị USB");
        }

        if (!connection.claimInterface(printerInterface, true)) {
            connection.close();
            throw new DeviceException(DeviceErrorCode.CONNECTION_FAILED, "Không chiếm được interface USB");
        }

        claimedInterface = printerInterface;
        outEndpoint = UsbDiscovery.findBulkEndpoint(printerInterface, UsbConstants.USB_DIR_OUT);
        inEndpoint = UsbDiscovery.findBulkEndpoint(printerInterface, UsbConstants.USB_DIR_IN);
        serialNumber = readSerial();
        deviceConnection = connection;
    }

    @Override
    public void write(byte[] data, long deadlineMillis) throws DeviceException {
        UsbDeviceConnection connection = requireConnection();
        UsbEndpoint endpoint = outEndpoint;
        writeInChunks(data, deadlineMillis, (buffer, offset, length, timeoutMillis) ->
                connection.bulkTransfer(endpoint, buffer, offset, length, timeoutMillis));
    }

    @Override
    public byte[] read(int maxBytes, long deadlineMillis) throws DeviceException {
        UsbDeviceConnection connection = requireConnection();
        UsbEndpoint endpoint = inEndpoint;

        if (endpoint == null) {
            throw new DeviceException(DeviceErrorCode.READ_NOT_SUPPORTED, "Máy in USB không có endpoint đọc");
        }

        byte[] buffer = new byte[maxBytes];
        int received = connection.bulkTransfer(endpoint, buffer, maxBytes, remainingMillis(deadlineMillis));

        if (received >= 0) {
            return Arrays.copyOf(buffer, received);
        }

        if (!isOpen()) {
            throw new DeviceException(DeviceErrorCode.READ_FAILED, "Mất kết nối USB khi đọc");
        }

        return new byte[0];
    }

    /** Nhả interface và đóng kết nối USB; gọi được trong lúc luồng khác đang bulkTransfer để cắt ngang. */
    @Override
    public synchronized void close() {
        UsbDeviceConnection connection = deviceConnection;
        deviceConnection = null;

        if (connection == null) {
            return;
        }

        connection.releaseInterface(claimedInterface);
        connection.close();
    }

    /** Rút dây không làm UsbDeviceConnection tự báo lỗi, nên kiểm thêm thiết bị còn trong danh sách của hệ thống. */
    @Override
    public boolean isOpen() {
        return deviceConnection != null && usbManager.getDeviceList().containsKey(device.getDeviceName());
    }

    @Override
    public String hardwareAddress() {
        return device.getDeviceName();
    }

    @Override
    public String serialNumber() {
        return serialNumber;
    }

    /** Ghi tới khi đủ, mỗi khúc tối đa 16 KB với thời gian chờ là phần còn lại của hạn. */
    public static void writeInChunks(
            byte[] data,
            long deadlineMillis,
            IChunkWriter chunkWriter) throws DeviceException {
        int written = 0;

        while (written < data.length) {
            int timeoutMillis = remainingMillis(deadlineMillis);

            if (timeoutMillis <= 0) {
                throw writeTimeout(written);
            }

            int length = Math.min(USB_CHUNK_SIZE_BYTES, data.length - written);
            int transferred = chunkWriter.write(data, written, length, timeoutMillis);

            if (transferred < 0) {
                throw failureAfter(written, deadlineMillis);
            }

            written += transferred;
        }
    }

    private UsbDeviceConnection requireConnection() throws DeviceException {
        UsbDeviceConnection connection = deviceConnection;

        if (connection == null) {
            throw new DeviceException(DeviceErrorCode.NOT_CONNECTED, "USB chưa mở");
        }

        return connection;
    }

    /** Từ Android 10, đọc serial khi chưa có quyền USB ném SecurityException. */
    private String readSerial() {
        try {
            return device.getSerialNumber();
        } catch (SecurityException exception) {
            return null;
        }
    }

    private static int remainingMillis(long deadlineMillis) {
        long remaining = deadlineMillis - System.currentTimeMillis();
        return (int) Math.max(0, Math.min(Integer.MAX_VALUE, remaining));
    }

    private static DeviceException failureAfter(int written, long deadlineMillis) {
        if (remainingMillis(deadlineMillis) <= 0) {
            return writeTimeout(written);
        }

        return new DeviceException(DeviceErrorCode.WRITE_FAILED, "Ghi USB thất bại").withBytesWritten(written);
    }

    private static DeviceException writeTimeout(int written) {
        return new DeviceException(DeviceErrorCode.WRITE_TIMEOUT, "Hết hạn khi ghi USB").withBytesWritten(written);
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/transport/BluetoothTransport.java`**

```java
package com.ndtcorepos.device.transport;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

/** Truyền byte qua Bluetooth cổ điển (RFCOMM, Serial Port Profile). */
public final class BluetoothTransport implements ITransport {

    private static final UUID SERIAL_PORT_PROFILE_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private static final long READ_POLL_INTERVAL_MS = 20;

    private static final long DRAIN_MIN_WAIT_MS = 100;

    private static final int DRAIN_SMALL_PAYLOAD_BYTES = 2_000;

    /** Tốc độ ước lượng máy in nhận dữ liệu qua SPP, dùng để chờ dữ liệu cuối kịp gửi trước khi đóng. */
    private static final int DRAIN_BYTES_PER_MS = 5;

    private final BluetoothDevice device;

    /** Hẹn giờ đóng socket khi lần ghi quá hạn. */
    private final ScheduledExecutorService timer;

    private volatile BluetoothSocket socket;

    /** Đang ghi/đọc: `close()` lúc này là cắt ngang nên đóng ngay, không chờ dữ liệu cuối. */
    private final AtomicBoolean operationInProgress = new AtomicBoolean();

    private volatile int lastWriteSizeBytes;

    public BluetoothTransport(BluetoothDevice device, ScheduledExecutorService timer) {
        this.device = device;
        this.timer = timer;
    }

    /** Mở socket RFCOMM; lần đầu hay lỗi với một số máy in giá rẻ nên thử lại một lần. */
    @Override
    public void open() throws DeviceException {
        try {
            socket = connectWithRetry();
        } catch (SecurityException exception) {
            throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "Thiếu quyền Bluetooth", exception);
        } catch (IOException exception) {
            throw new DeviceException(DeviceErrorCode.CONNECTION_FAILED, "Không kết nối được Bluetooth", exception);
        }
    }

    @Override
    public void write(byte[] data, long deadlineMillis) throws DeviceException {
        BluetoothSocket current = requireSocket();
        operationInProgress.set(true);

        try {
            StreamWriter.writeAll(current.getOutputStream(), current, data, deadlineMillis, timer);
            lastWriteSizeBytes = data.length;
        } catch (IOException exception) {
            throw new DeviceException(DeviceErrorCode.WRITE_FAILED, "Không ghi được Bluetooth", exception);
        } finally {
            operationInProgress.set(false);
        }
    }

    /** BluetoothSocket không có timeout đọc nên hỏi số byte sẵn có theo chu kỳ tới khi có dữ liệu hoặc hết hạn. */
    @Override
    public byte[] read(int maxBytes, long deadlineMillis) throws DeviceException {
        BluetoothSocket current = requireSocket();
        operationInProgress.set(true);

        try {
            InputStream input = current.getInputStream();

            if (!waitForData(input, deadlineMillis)) {
                return new byte[0];
            }

            byte[] buffer = new byte[Math.min(maxBytes, input.available())];
            int received = input.read(buffer);
            return received < 0 ? new byte[0] : Arrays.copyOf(buffer, received);
        } catch (IOException exception) {
            throw new DeviceException(DeviceErrorCode.READ_FAILED, "Không đọc được Bluetooth", exception);
        } finally {
            operationInProgress.set(false);
        }
    }

    /** Đóng bình thường thì chờ dữ liệu cuối kịp gửi (flush không bảo đảm máy in đã nhận); cắt ngang thì đóng ngay. */
    @Override
    public void close() {
        BluetoothSocket current = socket;
        socket = null;

        if (current == null) {
            return;
        }

        if (!operationInProgress.get()) {
            waitForDrain();
        }

        closeQuietly(current);
    }

    @Override
    public boolean isOpen() {
        BluetoothSocket current = socket;
        return current != null && current.isConnected();
    }

    @Override
    public String hardwareAddress() {
        return device.getAddress().toUpperCase(Locale.ROOT);
    }

    @Override
    public String serialNumber() {
        return null;
    }

    private BluetoothSocket connectWithRetry() throws IOException {
        try {
            return connectOnce();
        } catch (IOException firstFailure) {
            return connectOnce();
        }
    }

    private BluetoothSocket connectOnce() throws IOException {
        BluetoothSocket candidate = device.createRfcommSocketToServiceRecord(SERIAL_PORT_PROFILE_UUID);

        try {
            candidate.connect();
            return candidate;
        } catch (IOException exception) {
            closeQuietly(candidate);
            throw exception;
        }
    }

    private BluetoothSocket requireSocket() throws DeviceException {
        BluetoothSocket current = socket;

        if (current == null) {
            throw new DeviceException(DeviceErrorCode.NOT_CONNECTED, "Bluetooth chưa mở");
        }

        return current;
    }

    private static boolean waitForData(InputStream input, long deadlineMillis) throws IOException {
        while (input.available() == 0) {
            if (System.currentTimeMillis() >= deadlineMillis) {
                return false;
            }

            sleepQuietly(READ_POLL_INTERVAL_MS);
        }

        return true;
    }

    private void waitForDrain() {
        int bytes = lastWriteSizeBytes;
        long waitMillis = bytes <= DRAIN_SMALL_PAYLOAD_BYTES ? DRAIN_MIN_WAIT_MS : bytes / DRAIN_BYTES_PER_MS;
        sleepQuietly(waitMillis);
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    private static void closeQuietly(BluetoothSocket target) {
        try {
            target.close();
        } catch (IOException ignored) {
            // Socket đang đóng dở; không còn việc gì để làm thêm.
        }
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/transport/LanTransport.java`**

```java
package com.ndtcorepos.device.transport;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.Arrays;
import java.util.concurrent.ScheduledExecutorService;

/** Truyền byte qua TCP. */
public final class LanTransport implements ITransport {

    private static final int LAN_CONNECT_TIMEOUT_MS = 5_000;

    private final String host;

    private final int port;

    /** Hẹn giờ đóng socket khi lần ghi quá hạn (rút dây mạng thường không làm socket báo lỗi ngay). */
    private final ScheduledExecutorService timer;

    private volatile Socket socket;

    public LanTransport(
            String host,
            int port,
            ScheduledExecutorService timer) {
        this.host = host;
        this.port = port;
        this.timer = timer;
    }

    @Override
    public void open() throws DeviceException {
        Socket candidate = new Socket();

        try {
            candidate.connect(new InetSocketAddress(host, port), LAN_CONNECT_TIMEOUT_MS);
            socket = candidate;
        } catch (IOException exception) {
            closeQuietly(candidate);
            throw new DeviceException(
                    DeviceErrorCode.CONNECTION_FAILED,
                    "Không kết nối được " + hardwareAddress(),
                    exception);
        }
    }

    @Override
    public void write(byte[] data, long deadlineMillis) throws DeviceException {
        Socket current = requireSocket();

        try {
            StreamWriter.writeAll(current.getOutputStream(), current, data, deadlineMillis, timer);
        } catch (IOException exception) {
            throw new DeviceException(DeviceErrorCode.WRITE_FAILED, "Không ghi được qua mạng", exception);
        }
    }

    @Override
    public byte[] read(int maxBytes, long deadlineMillis) throws DeviceException {
        Socket current = requireSocket();
        long remainingMillis = deadlineMillis - System.currentTimeMillis();

        if (remainingMillis <= 0) {
            return new byte[0];
        }

        try {
            current.setSoTimeout((int) Math.min(Integer.MAX_VALUE, remainingMillis));
            byte[] buffer = new byte[maxBytes];
            int received = current.getInputStream().read(buffer);
            return received < 0 ? closedByPeer() : Arrays.copyOf(buffer, received);
        } catch (SocketTimeoutException exception) {
            return new byte[0];
        } catch (IOException exception) {
            throw new DeviceException(DeviceErrorCode.READ_FAILED, "Không đọc được qua mạng", exception);
        }
    }

    @Override
    public void close() {
        Socket current = socket;
        socket = null;

        if (current != null) {
            closeQuietly(current);
        }
    }

    @Override
    public boolean isOpen() {
        Socket current = socket;
        return current != null && current.isConnected() && !current.isClosed();
    }

    @Override
    public String hardwareAddress() {
        return host + ":" + port;
    }

    @Override
    public String serialNumber() {
        return null;
    }

    /** Máy in đóng kết nối phía nó: đóng phía app để `isOpen()` phản ánh đúng rồi báo lỗi. */
    private byte[] closedByPeer() throws DeviceException {
        close();
        throw new DeviceException(DeviceErrorCode.READ_FAILED, "Máy in đã đóng kết nối");
    }

    private Socket requireSocket() throws DeviceException {
        Socket current = socket;

        if (current == null) {
            throw new DeviceException(DeviceErrorCode.NOT_CONNECTED, "Kết nối mạng chưa mở");
        }

        return current;
    }

    private static void closeQuietly(Socket target) {
        try {
            target.close();
        } catch (IOException ignored) {
            // Socket đang đóng dở; không còn việc gì để làm thêm.
        }
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/transport/TransportFactory.java`**

```java
package com.ndtcorepos.device.transport;

import android.hardware.usb.UsbManager;

import com.ndtcorepos.device.discovery.BluetoothDiscovery;
import com.ndtcorepos.device.discovery.UsbDiscovery;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceType;

import java.util.concurrent.ScheduledExecutorService;

/** Tạo đúng transport cho một địa chỉ; transport trả về chưa mở. */
public final class TransportFactory implements ITransportFactory {

    private final UsbManager usbManager;

    private final UsbDiscovery usbDiscovery;

    private final BluetoothDiscovery bluetoothDiscovery;

    /** Hẹn giờ đóng socket khi ghi quá hạn, dùng chung cho mọi transport Bluetooth/LAN. */
    private final ScheduledExecutorService timer;

    public TransportFactory(
            UsbManager usbManager,
            UsbDiscovery usbDiscovery,
            BluetoothDiscovery bluetoothDiscovery,
            ScheduledExecutorService timer) {
        this.usbManager = usbManager;
        this.usbDiscovery = usbDiscovery;
        this.bluetoothDiscovery = bluetoothDiscovery;
        this.timer = timer;
    }

    @Override
    public ITransport create(DeviceAddress address) throws DeviceException {
        if (address.type() == DeviceType.USB) {
            return createUsb(address);
        }

        if (address.type() == DeviceType.BLUETOOTH) {
            return createBluetooth(address);
        }

        return createLan(address);
    }

    private ITransport createUsb(DeviceAddress address) throws DeviceException {
        return new UsbTransport(usbManager, usbDiscovery.find(address));
    }

    private ITransport createBluetooth(DeviceAddress address) throws DeviceException {
        return new BluetoothTransport(bluetoothDiscovery.findBonded(address.mac()), timer);
    }

    private ITransport createLan(DeviceAddress address) {
        return new LanTransport(address.host(), address.port(), timer);
    }
}
```

- [ ] **Step 4: Chạy test, mong đợi PASS** — cùng lệnh Step 2 → 10 test pass.

- [ ] **Step 5: Kiểm quy ước** — như Task 1.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/device/transport/StreamWriter.java
git add android/app/src/main/java/com/ndtcorepos/device/transport/UsbTransport.java
git add android/app/src/main/java/com/ndtcorepos/device/transport/BluetoothTransport.java
git add android/app/src/main/java/com/ndtcorepos/device/transport/LanTransport.java
git add android/app/src/main/java/com/ndtcorepos/device/transport/TransportFactory.java
git add android/app/src/test/java/com/ndtcorepos/device/transport/StreamWriterTest.java
git add android/app/src/test/java/com/ndtcorepos/device/transport/UsbTransportTest.java
git commit -m "feat: add USB, Bluetooth and LAN transports with deadline-bound writes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Monitor, `DeviceService`, `DeviceFactory`

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/device/monitor/IDisconnectMonitor.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/monitor/UsbDetachMonitor.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/monitor/BluetoothDisconnectMonitor.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/DeviceService.java`
- Create: `android/app/src/main/java/com/ndtcorepos/device/DeviceFactory.java`
- Test: `android/app/src/test/java/com/ndtcorepos/device/DeviceServiceTest.java`

**Interfaces:**
- Consumes: `ConnectionPool`, `IDisconnectListener` (Task 2); discovery + `UsbPermission` (Task 3); `TransportFactory` (Task 4).
- Produces: `IDisconnectMonitor` (`start`, `stop`); `DeviceService(discoveries, connectionPool, monitors, discoveryExecutor, timerExecutor)` với `start()` (package-private), `discover(DeviceType)`, `connect`, `write`, `read`, `disconnect`, `close()`; `DeviceFactory.create(Context, IDisconnectListener) → DeviceService` đã `start()`.

- [ ] **Step 1: Viết test**

**File: `android/app/src/test/java/com/ndtcorepos/device/DeviceServiceTest.java`**

```java
package com.ndtcorepos.device;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.discovery.IDeviceDiscovery;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;
import com.ndtcorepos.device.model.DeviceType;
import com.ndtcorepos.device.monitor.IDisconnectMonitor;

import org.junit.Before;
import org.junit.Test;

import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class DeviceServiceTest {

    private static final long TIMEOUT_SECONDS = 5;

    /** Monitor giả đếm số lần bật/tắt. */
    private static final class CountingMonitor implements IDisconnectMonitor {

        private final AtomicInteger startCount = new AtomicInteger();

        private final AtomicInteger stopCount = new AtomicInteger();

        @Override
        public void start() {
            startCount.incrementAndGet();
        }

        @Override
        public void stop() {
            stopCount.incrementAndGet();
        }
    }

    private final CountingMonitor monitor = new CountingMonitor();

    private final CountDownLatch discoveryGate = new CountDownLatch(1);

    private List<DeviceInfo> usbDevices;

    private DeviceService deviceService;

    @Before
    public void setUp() throws Exception {
        DeviceAddress usbAddress = DeviceAddress.usb(1, 2, null, "/dev/bus/usb/001/004");
        usbDevices = Collections.singletonList(
                DeviceInfo.usb("usb:/dev/bus/usb/001/004", "XP-80C", usbAddress, null, null, false));

        Map<DeviceType, IDeviceDiscovery> discoveries = new EnumMap<>(DeviceType.class);
        discoveries.put(DeviceType.USB, this::discoverUsbAfterGate);

        ConnectionPool connectionPool = new ConnectionPool(
                address -> {
                    throw new DeviceException(DeviceErrorCode.CONNECTION_FAILED, "không dùng");
                },
                (connectionId, reason) -> { },
                Executors.newCachedThreadPool(),
                Executors.newSingleThreadExecutor(),
                Executors::newSingleThreadExecutor);
        deviceService = new DeviceService(
                discoveries,
                connectionPool,
                Collections.singletonList(monitor),
                Executors.newSingleThreadExecutor(),
                Executors.newSingleThreadScheduledExecutor());
        deviceService.start();
    }

    @Test
    public void discoverUsesDiscoveryOfRequestedType() throws Exception {
        discoveryGate.countDown();

        assertSame(usbDevices, await(deviceService.discover(DeviceType.USB)));
    }

    @Test
    public void discoverLanIsInvalidArgument() throws Exception {
        assertEquals(DeviceErrorCode.INVALID_ARGUMENT, failureOf(deviceService.discover(DeviceType.LAN)).errorCode());
    }

    @Test
    public void startStartsMonitorsAndRepeatedCloseStopsThemOnce() {
        deviceService.close();
        deviceService.close();

        assertEquals(1, monitor.startCount.get());
        assertEquals(1, monitor.stopCount.get());
    }

    @Test
    public void callsAfterCloseAreServiceClosed() throws Exception {
        deviceService.close();

        DeviceAddress lanAddress = DeviceAddress.lan("10.0.0.1", 9100);
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(deviceService.discover(DeviceType.USB)).errorCode());
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(deviceService.connect(lanAddress)).errorCode());
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(deviceService.disconnect("lan:x")).errorCode());
    }

    @Test
    public void closeLetsRunningDiscoveryFinish() throws Exception {
        CompletableFuture<List<DeviceInfo>> running = deviceService.discover(DeviceType.USB);

        deviceService.close();
        discoveryGate.countDown();

        assertSame(usbDevices, await(running));
        assertTrue(running.isDone());
    }

    private List<DeviceInfo> discoverUsbAfterGate() {
        try {
            discoveryGate.await(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }

        return usbDevices;
    }

    private static <T> T await(CompletableFuture<T> future) throws Exception {
        return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    private static DeviceException failureOf(CompletableFuture<?> future) throws Exception {
        try {
            future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (ExecutionException exception) {
            return (DeviceException) exception.getCause();
        }

        throw new AssertionError("Future thành công, mong đợi lỗi");
    }
}
```

- [ ] **Step 2: Chạy test, mong đợi FAIL** — `cd android && ./gradlew :app:testDebugUnitTest --tests "com.ndtcorepos.device.DeviceServiceTest" -q` → lỗi compile.

- [ ] **Step 3: Viết code**

**File: `android/app/src/main/java/com/ndtcorepos/device/monitor/IDisconnectMonitor.java`**

```java
package com.ndtcorepos.device.monitor;

/** Nghe tín hiệu mất kết nối từ hệ thống; `start`/`stop` gọi nhiều lần không sao. */
public interface IDisconnectMonitor {

    void start();

    void stop();
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/monitor/UsbDetachMonitor.java`**

```java
package com.ndtcorepos.device.monitor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import androidx.core.content.ContextCompat;
import androidx.core.content.IntentCompat;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.model.DisconnectReason;

/** Báo `ConnectionPool` khi một thiết bị USB bị rút. */
public final class UsbDetachMonitor implements IDisconnectMonitor {

    private final Context context;

    private final ConnectionPool connectionPool;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context receiverContext, Intent intent) {
            onDetached(intent);
        }
    };

    private boolean started;

    public UsbDetachMonitor(Context context, ConnectionPool connectionPool) {
        this.context = context;
        this.connectionPool = connectionPool;
    }

    /** Đăng ký nhận broadcast rút USB của hệ thống, chỉ nhận trong app. */
    @Override
    public synchronized void start() {
        if (started) {
            return;
        }

        IntentFilter filter = new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED);
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        started = true;
    }

    @Override
    public synchronized void stop() {
        if (!started) {
            return;
        }

        context.unregisterReceiver(receiver);
        started = false;
    }

    /** Chạy trên luồng UI nên chỉ báo cho pool, việc đóng kết nối diễn ra ở luồng khác. */
    private void onDetached(Intent intent) {
        UsbDevice device = IntentCompat.getParcelableExtra(intent, UsbManager.EXTRA_DEVICE, UsbDevice.class);

        if (device != null) {
            connectionPool.onHardwareLost(device.getDeviceName(), DisconnectReason.USB_DETACHED);
        }
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/monitor/BluetoothDisconnectMonitor.java`**

```java
package com.ndtcorepos.device.monitor;

import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import androidx.core.content.ContextCompat;
import androidx.core.content.IntentCompat;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.model.DisconnectReason;

/** Báo `ConnectionPool` khi kết nối Bluetooth tới một thiết bị mất (ra khỏi tầm sóng, tắt máy in). */
public final class BluetoothDisconnectMonitor implements IDisconnectMonitor {

    private final Context context;

    private final ConnectionPool connectionPool;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context receiverContext, Intent intent) {
            onDisconnected(intent);
        }
    };

    private boolean started;

    public BluetoothDisconnectMonitor(Context context, ConnectionPool connectionPool) {
        this.context = context;
        this.connectionPool = connectionPool;
    }

    /** Đăng ký nhận broadcast mất liên kết ACL của hệ thống, chỉ nhận trong app. */
    @Override
    public synchronized void start() {
        if (started) {
            return;
        }

        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_ACL_DISCONNECTED);
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        started = true;
    }

    @Override
    public synchronized void stop() {
        if (!started) {
            return;
        }

        context.unregisterReceiver(receiver);
        started = false;
    }

    /** Chạy trên luồng UI nên chỉ báo cho pool, việc đóng kết nối diễn ra ở luồng khác. */
    private void onDisconnected(Intent intent) {
        BluetoothDevice device = IntentCompat.getParcelableExtra(
                intent,
                BluetoothDevice.EXTRA_DEVICE,
                BluetoothDevice.class);

        if (device != null) {
            connectionPool.onHardwareLost(device.getAddress(), DisconnectReason.BLUETOOTH_DISCONNECTED);
        }
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/DeviceService.java`**

```java
package com.ndtcorepos.device;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.discovery.IDeviceDiscovery;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.ConnectedDevice;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;
import com.ndtcorepos.device.model.DeviceType;
import com.ndtcorepos.device.monitor.IDisconnectMonitor;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;

/** Cửa vào duy nhất của tầng thiết bị cho bridge: quét, kết nối, ghi/đọc, ngắt và vòng đời. */
public final class DeviceService {

    private final Map<DeviceType, IDeviceDiscovery> discoveries;

    private final ConnectionPool connectionPool;

    private final List<IDisconnectMonitor> monitors;

    /** Một luồng chạy việc quét. */
    private final ExecutorService discoveryExecutor;

    /** Hẹn giờ đóng socket của transport Bluetooth/LAN; service tắt nó khi đóng. */
    private final ScheduledExecutorService timerExecutor;

    private boolean closed;

    public DeviceService(
            Map<DeviceType, IDeviceDiscovery> discoveries,
            ConnectionPool connectionPool,
            List<IDisconnectMonitor> monitors,
            ExecutorService discoveryExecutor,
            ScheduledExecutorService timerExecutor) {
        this.discoveries = discoveries;
        this.connectionPool = connectionPool;
        this.monitors = monitors;
        this.discoveryExecutor = discoveryExecutor;
        this.timerExecutor = timerExecutor;
    }

    /** Chỉ `DeviceFactory` gọi, đúng một lần sau khi tạo. */
    void start() {
        for (IDisconnectMonitor monitor : monitors) {
            monitor.start();
        }
    }

    public CompletableFuture<List<DeviceInfo>> discover(DeviceType type) {
        IDeviceDiscovery discovery = discoveries.get(type);

        if (discovery == null) {
            return failedFuture(new DeviceException(
                    DeviceErrorCode.INVALID_ARGUMENT,
                    "Không quét được thiết bị loại " + type.wireValue()));
        }

        CompletableFuture<List<DeviceInfo>> result = new CompletableFuture<>();

        synchronized (this) {
            if (closed) {
                return failedFuture(serviceClosed());
            }

            discoveryExecutor.execute(() -> runDiscovery(discovery, result));
        }

        return result;
    }

    public CompletableFuture<ConnectedDevice> connect(DeviceAddress address) {
        return connectionPool.connect(address);
    }

    public CompletableFuture<Void> write(
            String connectionId,
            byte[] data,
            long timeoutMillis) {
        return connectionPool.write(connectionId, data, timeoutMillis);
    }

    public CompletableFuture<byte[]> read(
            String connectionId,
            int maxBytes,
            long timeoutMillis) {
        return connectionPool.read(connectionId, maxBytes, timeoutMillis);
    }

    public CompletableFuture<Void> disconnect(String connectionId) {
        return connectionPool.disconnect(connectionId);
    }

    /** Gọi nhiều lần không sao; lần quét đang chạy được chạy xong, mọi lời gọi sau đó bị từ chối. */
    public void close() {
        synchronized (this) {
            if (closed) {
                return;
            }

            closed = true;
            discoveryExecutor.shutdown();
        }

        for (IDisconnectMonitor monitor : monitors) {
            monitor.stop();
        }

        connectionPool.closeAll();
        timerExecutor.shutdown();
    }

    private static void runDiscovery(IDeviceDiscovery discovery, CompletableFuture<List<DeviceInfo>> result) {
        try {
            result.complete(discovery.discover());
        } catch (DeviceException | RuntimeException exception) {
            result.completeExceptionally(exception);
        }
    }

    private static DeviceException serviceClosed() {
        return new DeviceException(DeviceErrorCode.SERVICE_CLOSED, "Dịch vụ thiết bị đã đóng");
    }

    private static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/device/DeviceFactory.java`**

```java
package com.ndtcorepos.device;

import android.content.Context;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.connection.IDisconnectListener;
import com.ndtcorepos.device.discovery.BluetoothDiscovery;
import com.ndtcorepos.device.discovery.IDeviceDiscovery;
import com.ndtcorepos.device.discovery.UsbDiscovery;
import com.ndtcorepos.device.model.DeviceType;
import com.ndtcorepos.device.monitor.BluetoothDisconnectMonitor;
import com.ndtcorepos.device.monitor.IDisconnectMonitor;
import com.ndtcorepos.device.monitor.UsbDetachMonitor;
import com.ndtcorepos.device.permission.UsbPermission;
import com.ndtcorepos.device.transport.TransportFactory;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/** Nơi lắp ráp tầng thiết bị: tạo các phần sống suốt vòng đời service, nối chúng lại và trả service đã sẵn sàng. */
public final class DeviceFactory {

    private DeviceFactory() {
    }

    public static DeviceService create(Context context, IDisconnectListener listener) {
        UsbManager usbManager = context.getSystemService(UsbManager.class);
        UsbPermission usbPermission = new UsbPermission(context, usbManager);
        UsbDiscovery usbDiscovery = new UsbDiscovery(usbManager, usbPermission);
        BluetoothDiscovery bluetoothDiscovery = new BluetoothDiscovery(context);
        ScheduledExecutorService timerExecutor = Executors.newSingleThreadScheduledExecutor();

        TransportFactory transportFactory = new TransportFactory(
                usbManager,
                usbDiscovery,
                bluetoothDiscovery,
                timerExecutor);
        ConnectionPool connectionPool = new ConnectionPool(
                transportFactory,
                listener,
                Executors.newCachedThreadPool(),
                Executors.newSingleThreadExecutor(),
                Executors::newSingleThreadExecutor);

        Map<DeviceType, IDeviceDiscovery> discoveries = new EnumMap<>(DeviceType.class);
        discoveries.put(DeviceType.USB, usbDiscovery);
        discoveries.put(DeviceType.BLUETOOTH, bluetoothDiscovery);

        List<IDisconnectMonitor> monitors = Arrays.asList(
                new UsbDetachMonitor(context, connectionPool),
                new BluetoothDisconnectMonitor(context, connectionPool));

        DeviceService deviceService = new DeviceService(
                discoveries,
                connectionPool,
                monitors,
                Executors.newSingleThreadExecutor(),
                timerExecutor);
        deviceService.start();
        return deviceService;
    }
}
```

- [ ] **Step 4: Chạy toàn bộ JUnit, mong đợi PASS** — `cd android && ./gradlew :app:cleanTestDebugUnitTest :app:testDebugUnitTest -q` → 53 test pass.

- [ ] **Step 5: Kiểm quy ước** — như Task 1.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/device/monitor/IDisconnectMonitor.java
git add android/app/src/main/java/com/ndtcorepos/device/monitor/UsbDetachMonitor.java
git add android/app/src/main/java/com/ndtcorepos/device/monitor/BluetoothDisconnectMonitor.java
git add android/app/src/main/java/com/ndtcorepos/device/DeviceService.java
git add android/app/src/main/java/com/ndtcorepos/device/DeviceFactory.java
git add android/app/src/test/java/com/ndtcorepos/device/DeviceServiceTest.java
git commit -m "feat: add device service, factory and disconnect monitors" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Bridge React Native, gỡ `thermalprinter/`

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/bridge/NdtCorePosPackage.java`
- Create: `android/app/src/main/java/com/ndtcorepos/bridge/device/DeviceModule.java`
- Create: `android/app/src/main/java/com/ndtcorepos/bridge/device/DeviceMapper.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/MainApplication.kt`, `android/app/src/main/AndroidManifest.xml`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/` (toàn bộ)

**Interfaces:**
- Consumes: `DeviceFactory`, `DeviceService` (Task 5); model/lỗi (Task 1); `IDisconnectListener` (Task 2).
- Produces: native module JS tên `DeviceModule` với `discover(type)`, `connect(address)` → `{connectionId, serialNumber}`, `write(connectionId, base64Data, timeoutMs)`, `read(connectionId, maxBytes, timeoutMs)` → base64 | null, `disconnect(connectionId)`; sự kiện `DeviceDisconnected` `{connectionId, reason}`; mã lỗi Promise = tên `DeviceErrorCode` hoặc `INTERNAL_ERROR`, lỗi ghi có `userInfo.bytesWritten`.

Bridge không có unit test (chỉ đổi kiểu và gọi xuống); được kiểm qua compile ở task này, Jest phía TS ở Task 7 và máy thật ở Task 9. Sau task này app chạy trên máy chưa dùng được máy in cho tới khi xong Task 7 (JS vẫn gọi module cũ) — bình thường trong branch.

- [ ] **Step 1: Viết bridge**

**File: `android/app/src/main/java/com/ndtcorepos/bridge/NdtCorePosPackage.java`**

```java
package com.ndtcorepos.bridge;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.ndtcorepos.bridge.device.DeviceModule;

import java.util.Collections;
import java.util.List;

/** Đăng ký mọi native module của app với React Native. */
public final class NdtCorePosPackage implements ReactPackage {

    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        return Collections.singletonList(new DeviceModule(reactContext));
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/bridge/device/DeviceModule.java`**

```java
package com.ndtcorepos.bridge.device;

import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.ndtcorepos.common.CodedException;
import com.ndtcorepos.device.DeviceFactory;
import com.ndtcorepos.device.DeviceService;
import com.ndtcorepos.device.connection.IDisconnectListener;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DisconnectReason;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.function.Function;

/** Các hàm JS gọi tới tầng thiết bị: đổi tham số, gọi `DeviceService`, trả Promise; phát sự kiện mất kết nối. */
public final class DeviceModule extends ReactContextBaseJavaModule implements IDisconnectListener {

    private static final String LOG_SOURCE = "DeviceModule";

    private static final String MODULE_NAME = "DeviceModule";

    private static final String DISCONNECTED_EVENT = "DeviceDisconnected";

    private static final String INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

    private final DeviceService deviceService;

    public DeviceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.deviceService = DeviceFactory.create(reactContext, this);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void discover(String type, Promise promise) {
        try {
            settle(deviceService.discover(DeviceMapper.toDeviceType(type)), promise, DeviceMapper::toWritableArray);
        } catch (DeviceException exception) {
            reject(promise, exception);
        }
    }

    @ReactMethod
    public void connect(ReadableMap address, Promise promise) {
        try {
            settle(deviceService.connect(DeviceMapper.toAddress(address)), promise, DeviceMapper::toWritableMap);
        } catch (DeviceException exception) {
            reject(promise, exception);
        }
    }

    @ReactMethod
    public void write(
            String connectionId,
            String base64Data,
            double timeoutMs,
            Promise promise) {
        try {
            byte[] data = DeviceMapper.toBytes(base64Data);
            long timeoutMillis = DeviceMapper.toPositiveLong(timeoutMs, "timeoutMs");
            settle(deviceService.write(connectionId, data, timeoutMillis), promise, ignored -> null);
        } catch (DeviceException exception) {
            reject(promise, exception);
        }
    }

    @ReactMethod
    public void read(
            String connectionId,
            double maxBytes,
            double timeoutMs,
            Promise promise) {
        try {
            int maxByteCount = DeviceMapper.toPositiveInt(maxBytes, "maxBytes");
            long timeoutMillis = DeviceMapper.toPositiveLong(timeoutMs, "timeoutMs");
            CompletableFuture<byte[]> response = deviceService.read(connectionId, maxByteCount, timeoutMillis);
            settle(response, promise, DeviceMapper::toBase64OrNull);
        } catch (DeviceException exception) {
            reject(promise, exception);
        }
    }

    @ReactMethod
    public void disconnect(String connectionId, Promise promise) {
        settle(deviceService.disconnect(connectionId), promise, ignored -> null);
    }

    /** React Native gọi khi reload hoặc huỷ module: đóng mọi kết nối, receiver và luồng. */
    @Override
    public void invalidate() {
        deviceService.close();
        super.invalidate();
    }

    /** Phát sự kiện lên JS; bỏ qua khi React không còn chạy (đang reload). */
    @Override
    public void onDisconnected(String connectionId, DisconnectReason reason) {
        ReactApplicationContext context = getReactApplicationContext();

        if (!context.hasActiveReactInstance()) {
            return;
        }

        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(DISCONNECTED_EVENT, DeviceMapper.toDisconnectedEvent(connectionId, reason));
    }

    /** Không bao giờ chờ kết quả: callback chạy trên luồng hoàn tất future, React Native tự chuyển về JS. */
    private static <T> void settle(
            CompletableFuture<T> future,
            Promise promise,
            Function<T, Object> toJs) {
        future.whenComplete((value, error) -> complete(promise, value, error, toJs));
    }

    private static <T> void complete(
            Promise promise,
            T value,
            Throwable error,
            Function<T, Object> toJs) {
        if (error == null) {
            promise.resolve(toJs.apply(value));
            return;
        }

        reject(promise, unwrap(error));
    }

    private static void reject(Promise promise, Throwable error) {
        if (!(error instanceof CodedException)) {
            Log.e(LOG_SOURCE, "Lỗi không mong đợi ở tầng thiết bị", error);
            promise.reject(INTERNAL_ERROR_CODE, error.getMessage(), error);
            return;
        }

        CodedException codedException = (CodedException) error;
        WritableMap userInfo = codedException instanceof DeviceException
                ? DeviceMapper.toUserInfo((DeviceException) codedException)
                : null;
        promise.reject(codedException.code(), codedException.getMessage(), codedException, userInfo);
    }

    private static Throwable unwrap(Throwable error) {
        if (error instanceof CompletionException && error.getCause() != null) {
            return error.getCause();
        }

        return error;
    }
}
```

**File: `android/app/src/main/java/com/ndtcorepos/bridge/device/DeviceMapper.java`**

```java
package com.ndtcorepos.bridge.device;

import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.ConnectedDevice;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;
import com.ndtcorepos.device.model.DeviceType;
import com.ndtcorepos.device.model.DisconnectReason;

import java.util.List;

/** Đổi dữ liệu giữa kiểu React Native và kiểu của tầng thiết bị; tham số sai ném `INVALID_ARGUMENT`. */
final class DeviceMapper {

    private DeviceMapper() {
    }

    static DeviceType toDeviceType(String wireValue) throws DeviceException {
        return DeviceType.fromWireValue(wireValue);
    }

    static DeviceAddress toAddress(ReadableMap map) throws DeviceException {
        DeviceType type = toDeviceType(requireString(map, "type"));

        if (type == DeviceType.USB) {
            return toUsbAddress(map);
        }

        if (type == DeviceType.BLUETOOTH) {
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
        putNullableString(map, "serialNumber", connectedDevice.serialNumber());
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

    static long toPositiveLong(double value, String fieldName) throws DeviceException {
        if (value <= 0 || value > Long.MAX_VALUE) {
            throw invalid(fieldName + " phải lớn hơn 0");
        }

        return (long) value;
    }

    static int toPositiveInt(double value, String fieldName) throws DeviceException {
        if (value <= 0 || value > Integer.MAX_VALUE) {
            throw invalid(fieldName + " phải lớn hơn 0");
        }

        return (int) value;
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

        if (device.type() == DeviceType.USB) {
            putNullableString(map, "manufacturerName", device.manufacturerName());
            putNullableString(map, "productName", device.productName());
            map.putBoolean("hasPermission", device.hasPermission());
        }

        return map;
    }

    private static WritableMap toWritableMap(DeviceAddress address) {
        WritableMap map = Arguments.createMap();
        map.putString("type", address.type().wireValue());

        if (address.type() == DeviceType.USB) {
            map.putInt("vendorId", address.vendorId());
            map.putInt("productId", address.productId());
            putNullableString(map, "serialNumber", address.serialNumber());
            putNullableString(map, "devicePath", address.devicePath());
            return map;
        }

        if (address.type() == DeviceType.BLUETOOTH) {
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

    private static DeviceException invalid(String message) {
        return new DeviceException(DeviceErrorCode.INVALID_ARGUMENT, message);
    }
}
```

- [ ] **Step 2: Đăng ký package mới, sửa comment manifest** — lưu script rồi chạy `node task6-edits.js .` ở gốc repo.

**Script: `task6-edits.js`**

```js
// Dùng: node <script> <đường dẫn gốc repo NDTCore.App>. Thiếu đoạn cũ ở đâu thì dừng và báo, không sửa dở.
const fs = require('fs');
const path = require('path');
const base = process.argv[2];

function applyEdits(edits) {
  const updates = [];

  for (const [relative, pairs] of Object.entries(edits)) {
    const file = path.join(base, relative);
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    let text = raw.replace(/\r\n/g, '\n');

    for (const [from, to] of pairs) {
      if (!text.includes(from)) {
        throw new Error('Không thấy đoạn cần sửa trong ' + relative + ':\n' + from.slice(0, 200));
      }

      text = text.replace(from, to);
    }

    updates.push([file, crlf ? text.replace(/\n/g, '\r\n') : text]);
  }

  for (const [file, text] of updates) {
    fs.writeFileSync(file, text);
  }

  console.log('Đã sửa ' + updates.length + ' file');
}

applyEdits({
  'android/app/src/main/java/com/ndtcorepos/MainApplication.kt': [
    ['import com.ndtcorepos.thermalprinter.module.ThermalPrinterPackage', 'import com.ndtcorepos.bridge.NdtCorePosPackage'],
    ['          add(ThermalPrinterPackage())', '          add(NdtCorePosPackage())'],
  ],
  'android/app/src/main/AndroidManifest.xml': [
    [
      '    <!-- Máy in nhiệt qua USB (com.ndtcorepos.thermalprinter) — trước do\n         AndroidManifest của @poriyaalar merge vào lúc autolink. -->',
      '    <!-- Kết nối thiết bị qua USB (com.ndtcorepos.device); không bắt buộc để app vẫn cài được trên máy không có USB host. -->',
    ],
  ],
});
```

- [ ] **Step 3: Xoá package cũ**

```bash
git rm -r -q android/app/src/main/java/com/ndtcorepos/thermalprinter
```

- [ ] **Step 4: Compile và chạy toàn bộ JUnit** — `cd android && ./gradlew :app:compileDebugJavaWithJavac :app:cleanTestDebugUnitTest :app:testDebugUnitTest -q` → không lỗi, 53 test pass. Rồi `npx jest` ở gốc repo → toàn bộ pass (TS chưa đổi, vẫn mock module cũ).

- [ ] **Step 5: Kiểm quy ước** — như Task 1.

- [ ] **Step 6: Commit** (file xoá đã được `git rm` stage)

```bash
git add android/app/src/main/java/com/ndtcorepos/bridge/NdtCorePosPackage.java
git add android/app/src/main/java/com/ndtcorepos/bridge/device/DeviceModule.java
git add android/app/src/main/java/com/ndtcorepos/bridge/device/DeviceMapper.java
git add android/app/src/main/java/com/ndtcorepos/MainApplication.kt
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat: expose DeviceModule bridge and remove thermalprinter native package" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: TS chuyển sang `DeviceModule`

**Files:**
- Create/Replace: `src/features/printer/adapters/native/DeviceModule.ts`
- Create/Replace: `src/features/printer/adapters/native/NativeConnectionPool.ts`
- Create/Replace: `src/features/printer/adapters/native/toPrinterError.ts`
- Create/Replace: `src/features/printer/adapters/native/NativeAdapter.ts`
- Create/Replace: `src/features/printer/adapters/testing/MockPrinterAdapter.ts`
- Test (create/replace): `src/features/printer/adapters/native/__tests__/DeviceModule.test.ts`
- Test (create/replace): `src/features/printer/adapters/native/__tests__/NativeConnectionPool.test.ts`
- Test (create/replace): `src/features/printer/adapters/native/__tests__/toPrinterError.test.ts`
- Test (create/replace): `src/features/printer/adapters/native/__tests__/NativeAdapter.test.ts`
- Test (create/replace): `src/features/printer/adapters/testing/__tests__/MockPrinterAdapter.test.ts`
- Modify (script): `src/features/printer/drivers/escpos/EscPosDriver.ts`
- Modify (script): `src/features/printer/drivers/tspl/TsplDriver.ts`
- Modify (script): `src/features/printer/adapters/IPrinterAdapter.ts`
- Modify (script): `src/features/printer/adapters/resolvePrinterAdapter.ts`
- Modify (script): `src/features/printer/connection/PrinterConnectionLock.ts`
- Modify (script): `src/features/printer/models/printer/PrinterDevice.ts`
- Modify (script): `src/features/printer/hooks/addPrinter/useConnectionSetup.ts`
- Modify (script): `jest.setup.js`
- Modify (script): `src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts`
- Modify (script): `src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts`
- Delete: `src/features/printer/adapters/native/PrinterNativeModule.ts`
- Delete: `src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts`
- Delete: `src/features/printer/transports/UsbTransport.ts`
- Delete: `src/features/printer/transports/__tests__/UsbTransport.test.ts`

**Interfaces:**
- Consumes (Task 6): native module `DeviceModule` như mô tả ở Task 6.
- Produces: `adapters/native/DeviceModule.ts` (`DeviceModule: DeviceModuleApi`, `subscribeDeviceDisconnected`, kiểu `Native*`); `NativeConnectionPool` + `nativeConnectionPool` (`acquire(address) → NativeConnectionLease { connectionId, serialNumber, release() }`); `toPrinterError(error)`; `NativeAdapter` (`canRead = true`, `getConnectionId()`); `createMockDeviceModule`, `createMockSubscribeDeviceDisconnected`; `PrinterConnectTarget.usb.serialNumber?`.

- [ ] **Step 1: Viết test mới / thay test cũ**

**File: `src/features/printer/adapters/native/__tests__/DeviceModule.test.ts`**

```ts
import { DeviceEventEmitter, NativeModules } from 'react-native';

const loadReal = () => jest.requireActual('../DeviceModule') as typeof import('../DeviceModule');

describe('DeviceModule', () => {
  afterEach(() => jest.clearAllMocks());

  it('discover gọi native với loại thiết bị', async () => {
    await loadReal().DeviceModule.discover('bluetooth');
    expect(NativeModules.DeviceModule.discover).toHaveBeenCalledWith('bluetooth');
  });

  it('connect gửi nguyên địa chỉ và trả kết quả native', async () => {
    const address = { type: 'usb', vendorId: 1, productId: 2, serialNumber: 'SN', devicePath: null } as const;
    await expect(loadReal().DeviceModule.connect(address)).resolves.toEqual({
      connectionId: 'mock-connection',
      serialNumber: null,
    });
    expect(NativeModules.DeviceModule.connect).toHaveBeenCalledWith(address);
  });

  it('write, read, disconnect gửi đúng tham số', async () => {
    const { DeviceModule } = loadReal();
    await DeviceModule.write('c1', 'QUI=', 5000);
    await DeviceModule.read('c1', 64, 1000);
    await DeviceModule.disconnect('c1');

    expect(NativeModules.DeviceModule.write).toHaveBeenCalledWith('c1', 'QUI=', 5000);
    expect(NativeModules.DeviceModule.read).toHaveBeenCalledWith('c1', 64, 1000);
    expect(NativeModules.DeviceModule.disconnect).toHaveBeenCalledWith('c1');
  });
});

describe('subscribeDeviceDisconnected', () => {
  it('gọi callback khi native phát DeviceDisconnected, ngừng gọi sau khi huỷ', () => {
    const callback = jest.fn();
    const unsubscribe = loadReal().subscribeDeviceDisconnected(callback);
    const event = { connectionId: 'usb:/dev/bus/usb/001/004', reason: 'usb_detached' };

    DeviceEventEmitter.emit('DeviceDisconnected', event);
    expect(callback).toHaveBeenCalledWith(event);

    unsubscribe();
    callback.mockClear();
    DeviceEventEmitter.emit('DeviceDisconnected', event);
    expect(callback).not.toHaveBeenCalled();
  });
});
```

**File: `src/features/printer/adapters/native/__tests__/NativeConnectionPool.test.ts`**

```ts
import type { DeviceDisconnectedEvent, NativeConnectedDevice, NativeDeviceAddress } from '../DeviceModule';
import { createMockDeviceModule } from '../../testing/MockPrinterAdapter';

type PoolModule = typeof import('../NativeConnectionPool');

const { NativeConnectionPool } = jest.requireActual('../NativeConnectionPool') as PoolModule;

const PRINTER_A: NativeDeviceAddress = { type: 'lan', host: '10.0.0.1', port: 9100 };

const PRINTER_A_BY_OTHER_ADDRESS: NativeDeviceAddress = {
  type: 'usb',
  vendorId: 1,
  productId: 2,
  serialNumber: 'SN',
  devicePath: null,
};

const connectedTo = (connectionId: string): NativeConnectedDevice => ({ connectionId, serialNumber: null });

/** Promise tự điều khiển được thời điểm resolve, để giả lập native connect đang chờ. */
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const createPool = () => {
  const deviceModule = createMockDeviceModule();
  let emitDisconnected: (event: DeviceDisconnectedEvent) => void = () => undefined;
  const pool = new NativeConnectionPool(deviceModule, (callback) => {
    emitDisconnected = callback;
    return () => undefined;
  });
  return { pool, deviceModule, emit: (event: DeviceDisconnectedEvent) => emitDisconnected(event) };
};

describe('NativeConnectionPool', () => {
  it('hai acquire cùng thiết bị dùng chung kết nối; chỉ release cuối cùng mới disconnect', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect.mockResolvedValue(connectedTo('lan:10.0.0.1:9100'));

    const first = await pool.acquire(PRINTER_A);
    const second = await pool.acquire(PRINTER_A_BY_OTHER_ADDRESS);
    await first.release();
    expect(deviceModule.disconnect).not.toHaveBeenCalled();

    await second.release();
    expect(deviceModule.disconnect).toHaveBeenCalledTimes(1);
    expect(deviceModule.disconnect).toHaveBeenCalledWith('lan:10.0.0.1:9100');
  });

  it('release gọi lặp lại chỉ trừ một lần', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect.mockResolvedValue(connectedTo('c1'));
    const first = await pool.acquire(PRINTER_A);
    await pool.acquire(PRINTER_A);

    await first.release();
    await first.release();

    expect(deviceModule.disconnect).not.toHaveBeenCalled();
  });

  it('release trong lúc acquire khác đang chờ connect không đóng nhầm kết nối', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect.mockResolvedValueOnce(connectedTo('c1'));
    const holder = await pool.acquire(PRINTER_A);
    const pendingConnect = deferred<NativeConnectedDevice>();
    deviceModule.connect.mockReturnValueOnce(pendingConnect.promise);

    const newcomer = pool.acquire(PRINTER_A);
    const holderRelease = holder.release();
    pendingConnect.resolve(connectedTo('c1'));
    await newcomer;
    await holderRelease;

    expect(deviceModule.disconnect).not.toHaveBeenCalled();
  });

  it('acquire lỗi không tăng bộ đếm và không chặn lần sau', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect.mockRejectedValueOnce({ code: 'CONNECTION_FAILED' });
    await expect(pool.acquire(PRINTER_A)).rejects.toEqual({ code: 'CONNECTION_FAILED' });

    deviceModule.connect.mockResolvedValueOnce(connectedTo('c1'));
    const lease = await pool.acquire(PRINTER_A);
    await lease.release();

    expect(deviceModule.disconnect).toHaveBeenCalledTimes(1);
  });

  it('sự kiện DeviceDisconnected xoá bộ đếm: lease cũ release không đóng phiên kết nối mới', async () => {
    const { pool, deviceModule, emit } = createPool();
    deviceModule.connect.mockResolvedValue(connectedTo('c1'));
    const staleLease = await pool.acquire(PRINTER_A);

    emit({ connectionId: 'c1', reason: 'usb_detached' });
    const freshLease = await pool.acquire(PRINTER_A);
    await staleLease.release();
    expect(deviceModule.disconnect).not.toHaveBeenCalled();

    await freshLease.release();
    expect(deviceModule.disconnect).toHaveBeenCalledTimes(1);
  });
});
```

**File: `src/features/printer/adapters/native/__tests__/toPrinterError.test.ts`**

```ts
import { toPrinterError } from '../toPrinterError';
import { PrinterErrorCode } from '../../../errors/PrinterError';

describe('toPrinterError', () => {
  it.each([
    ['INVALID_ARGUMENT', PrinterErrorCode.VALIDATION_ERROR],
    ['DEVICE_NOT_FOUND', PrinterErrorCode.PRINTER_NOT_FOUND],
    ['AMBIGUOUS_DEVICE', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['PERMISSION_DENIED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['BLUETOOTH_DISABLED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['CONNECTION_FAILED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['NOT_CONNECTED', PrinterErrorCode.PRINTER_NOT_CONNECTED],
    ['CONNECTION_LOST', PrinterErrorCode.PRINTER_NOT_CONNECTED],
    ['SERVICE_CLOSED', PrinterErrorCode.PRINTER_NOT_CONNECTED],
    ['WRITE_FAILED', PrinterErrorCode.PRINTER_WRITE_FAILED],
    ['WRITE_TIMEOUT', PrinterErrorCode.PRINTER_WRITE_FAILED],
    ['READ_NOT_SUPPORTED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['READ_FAILED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
  ])('mã native %s → %s, kèm thông báo tiếng Việt và lỗi gốc', (nativeCode, expected) => {
    const nativeError = { code: nativeCode, message: 'native message' };

    const error = toPrinterError(nativeError);

    expect(error.code).toBe(expected);
    expect(error.message).not.toBe('native message');
    expect(error.cause).toBe(nativeError);
  });

  it('lỗi không có mã native giữ UNKNOWN_ERROR và thông báo gốc', () => {
    const error = toPrinterError(new Error('native connect failed'));

    expect(error.code).toBe(PrinterErrorCode.UNKNOWN_ERROR);
    expect(error.message).toBe('native connect failed');
  });
});
```

**File: `src/features/printer/adapters/native/__tests__/NativeAdapter.test.ts`**

```ts
import { Platform } from 'react-native';
import { NativeAdapter } from '../NativeAdapter';
import { PrinterConnectionType } from '../../../models/printer/PrinterConnection';
import { PrinterErrorCode } from '../../../errors/PrinterError';

// `NativeAdapter.printText` có nhánh iOS gọi module in cũ của iOS. Jest preset RN mặc định Platform.OS='ios' — ép
// 'android' để test đúng nhánh DeviceModule chạy trên thiết bị.
const originalPlatformOS = Platform.OS;
beforeAll(() => {
  Platform.OS = 'android';
});
afterAll(() => {
  Platform.OS = originalPlatformOS;
});

const deviceModule = () =>
  (jest.requireMock('../DeviceModule') as {
    DeviceModule: { discover: jest.Mock; connect: jest.Mock; write: jest.Mock; read: jest.Mock; disconnect: jest.Mock };
  }).DeviceModule;

const lanTarget = { printerId: 'p1', connectionType: PrinterConnectionType.Lan, lan: { ip: '10.0.0.5', port: 9100 } };

const bluetoothTarget = {
  printerId: 'p2',
  connectionType: PrinterConnectionType.Bluetooth,
  bluetooth: { deviceId: 'AA:BB' },
};

describe('NativeAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('source là "native" và đọc được phản hồi', () => {
    const adapter = new NativeAdapter();
    expect(adapter.source).toBe('native');
    expect(adapter.canRead).toBe(true);
  });

  it('listDevices(lan) trả [] mà không gọi native', async () => {
    await expect(new NativeAdapter().listDevices(PrinterConnectionType.Lan)).resolves.toEqual([]);
    expect(deviceModule().discover).not.toHaveBeenCalled();
  });

  it('listDevices(bluetooth) dùng MAC làm deviceId', async () => {
    deviceModule().discover.mockResolvedValueOnce([
      { type: 'bluetooth', deviceId: 'bluetooth:AA:BB', name: 'BT', address: { type: 'bluetooth', mac: 'AA:BB' } },
    ]);
    const devices = await new NativeAdapter().listDevices(PrinterConnectionType.Bluetooth);
    expect(deviceModule().discover).toHaveBeenCalledWith('bluetooth');
    expect(devices).toEqual([{ deviceId: 'AA:BB', displayName: 'BT', rawDevice: { type: 'bluetooth', mac: 'AA:BB' } }]);
  });

  it('listDevices(usb) giữ deviceId vendorId:productId và đưa serial/devicePath vào rawDevice', async () => {
    deviceModule().discover.mockResolvedValueOnce([
      {
        type: 'usb',
        deviceId: 'usb:/dev/bus/usb/001/004',
        name: 'X',
        address: {
          type: 'usb',
          vendorId: 1155,
          productId: 22222,
          serialNumber: null,
          devicePath: '/dev/bus/usb/001/004',
        },
        manufacturerName: null,
        productName: 'X',
        hasPermission: false,
      },
    ]);
    const devices = await new NativeAdapter().listDevices(PrinterConnectionType.Usb);
    expect(devices).toEqual([
      {
        deviceId: '1155:22222',
        displayName: 'X',
        rawDevice: {
          vendorId: 1155,
          productId: 22222,
          serialNumber: null,
          devicePath: '/dev/bus/usb/001/004',
          manufacturerName: null,
          productName: 'X',
        },
      },
    ]);
  });

  it('connect gửi địa chỉ native theo từng loại kết nối', async () => {
    await new NativeAdapter().connect(lanTarget);
    await new NativeAdapter().connect(bluetoothTarget);
    await new NativeAdapter().connect({
      printerId: 'p3',
      connectionType: PrinterConnectionType.Usb,
      usb: { vendorId: 1155, productId: 22222, serialNumber: 'SN1' },
    });

    expect(deviceModule().connect).toHaveBeenNthCalledWith(1, { type: 'lan', host: '10.0.0.5', port: 9100 });
    expect(deviceModule().connect).toHaveBeenNthCalledWith(2, { type: 'bluetooth', mac: 'AA:BB' });
    expect(deviceModule().connect).toHaveBeenNthCalledWith(3, {
      type: 'usb',
      vendorId: 1155,
      productId: 22222,
      serialNumber: 'SN1',
      devicePath: null,
    });
  });

  it('connect(usb) thiếu target.usb -> VALIDATION_ERROR', async () => {
    const connect = new NativeAdapter().connect({ printerId: 'p1', connectionType: PrinterConnectionType.Usb });
    await expect(connect).rejects.toMatchObject({ code: PrinterErrorCode.VALIDATION_ERROR });
  });

  it('getConnectionId trả mã native sau connect, null trước connect', async () => {
    const adapter = new NativeAdapter();
    expect(adapter.getConnectionId()).toBeNull();

    deviceModule().connect.mockResolvedValueOnce({ connectionId: 'bluetooth:AA:BB', serialNumber: null });
    await adapter.connect(bluetoothTarget);
    expect(adapter.getConnectionId()).toBe('bluetooth:AA:BB');
  });

  it('write gửi base64 kèm hạn ghi theo connectionId', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.write(new Uint8Array([0x41, 0x42]));
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', 'QUI=', expect.any(Number));
  });

  it('printText encode ESC/POS rồi ghi theo connectionId', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.printText('<C>hi</C>', { cut: true, tailingLine: true, encoding: 'UTF8' });
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', expect.any(String), expect.any(Number));
  });

  it('read trả byte giải mã từ base64, null khi native trả null', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);

    deviceModule().read.mockResolvedValueOnce('QUI=');
    await expect(adapter.read(1000)).resolves.toEqual(new Uint8Array([0x41, 0x42]));
    await expect(adapter.read(1000)).resolves.toBeNull();
  });

  it('write trước connect -> PRINTER_NOT_CONNECTED', async () => {
    await expect(new NativeAdapter().write(new Uint8Array([1]))).rejects.toMatchObject({
      code: PrinterErrorCode.PRINTER_NOT_CONNECTED,
    });
  });

  it('lỗi native được đổi sang PrinterErrorException theo mã', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    deviceModule().write.mockRejectedValueOnce({ code: 'WRITE_TIMEOUT', message: 'timeout' });

    const write = adapter.write(new Uint8Array([1]));
    await expect(write).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_WRITE_FAILED });
  });

  it('disconnect trả lease (native disconnect) và lần thứ hai không làm gì', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.disconnect();
    await adapter.disconnect();
    expect(deviceModule().disconnect).toHaveBeenCalledTimes(1);
    expect(deviceModule().disconnect).toHaveBeenCalledWith('mock-connection');
  });
});
```

**File: `src/features/printer/adapters/testing/__tests__/MockPrinterAdapter.test.ts`**

```ts
import { createMockDeviceModule, createMockSubscribeDeviceDisconnected } from '../MockPrinterAdapter';

describe('MockPrinterAdapter', () => {
  it('createMockDeviceModule trả stub cho toàn bộ hàm của DeviceModule', async () => {
    const mock = createMockDeviceModule();
    await expect(mock.discover('usb')).resolves.toEqual([]);
    await expect(mock.connect({ type: 'lan', host: '10.0.0.1', port: 9100 })).resolves.toEqual({
      connectionId: 'mock-connection',
      serialNumber: null,
    });
    await expect(mock.write('mock-connection', 'QUI=', 1000)).resolves.toBeUndefined();
    await expect(mock.read('mock-connection', 16, 1000)).resolves.toBeNull();
    await expect(mock.disconnect('mock-connection')).resolves.toBeUndefined();
  });

  it('createMockSubscribeDeviceDisconnected trả hàm huỷ đăng ký', () => {
    const subscribe = createMockSubscribeDeviceDisconnected();
    expect(typeof subscribe(jest.fn())).toBe('function');
  });
});
```

- [ ] **Step 2: Chạy test, mong đợi FAIL** — `npx jest src/features/printer/adapters` → lỗi không tìm thấy module `../DeviceModule`, `../NativeConnectionPool`, `../toPrinterError`, export `createMockDeviceModule`.

- [ ] **Step 3: Viết code mới / thay file cũ**

**File: `src/features/printer/adapters/native/DeviceModule.ts`**

```ts
import { DeviceEventEmitter, NativeModules } from 'react-native';

/** Tên sự kiện native phát khi một kết nối mất ngoài ý muốn. */
const DEVICE_DISCONNECTED_EVENT = 'DeviceDisconnected';

/** Loại thiết bị quét được; LAN không quét (người dùng nhập IP). */
export type NativeDiscoverableType = 'usb' | 'bluetooth';

/** Địa chỉ USB gửi cho native. */
export interface NativeUsbAddress {
  readonly type: 'usb';

  readonly vendorId: number;

  readonly productId: number;

  /** `null` khi chưa biết (quét lúc chưa có quyền USB, hoặc máy in không có serial). */
  readonly serialNumber: string | null;

  /** Đường dẫn thiết bị lấy từ lần quét; chỉ đúng trong lần cắm hiện tại, không lưu. */
  readonly devicePath: string | null;
}

/** Địa chỉ Bluetooth gửi cho native. */
export interface NativeBluetoothAddress {
  readonly type: 'bluetooth';

  /** MAC, native chuẩn hoá viết hoa. */
  readonly mac: string;
}

/** Địa chỉ LAN gửi cho native. */
export interface NativeLanAddress {
  readonly type: 'lan';

  readonly host: string;

  readonly port: number;
}

export type NativeDeviceAddress = NativeUsbAddress | NativeBluetoothAddress | NativeLanAddress;

/** Thiết bị USB `discover` tìm thấy, chưa kết nối. */
export interface NativeUsbDeviceInfo {
  readonly type: 'usb';

  /** Định danh trong lần cắm hiện tại, dùng làm key danh sách; đổi khi rút ra cắm lại. */
  readonly deviceId: string;

  readonly name: string | null;

  /** Địa chỉ truyền lại nguyên vẹn khi `connect`. */
  readonly address: NativeUsbAddress;

  readonly manufacturerName: string | null;

  readonly productName: string | null;

  /** App đã được cấp quyền USB cho thiết bị này chưa; quét không mở hộp thoại xin quyền. */
  readonly hasPermission: boolean;
}

/** Thiết bị Bluetooth đã ghép đôi `discover` tìm thấy. */
export interface NativeBluetoothDeviceInfo {
  readonly type: 'bluetooth';

  readonly deviceId: string;

  readonly name: string | null;

  readonly address: NativeBluetoothAddress;
}

export type NativeDeviceInfo = NativeUsbDeviceInfo | NativeBluetoothDeviceInfo;

/** Kết quả `connect`. */
export interface NativeConnectedDevice {
  /** Mã mờ của kết nối, chỉ dùng trong phiên kết nối; không phân tích, không lưu. */
  readonly connectionId: string;

  /** Serial đọc được sau khi mở (USB); `null` nếu không có. */
  readonly serialNumber: string | null;
}

export type DisconnectReason = 'usb_detached' | 'bluetooth_disconnected' | 'io_error';

/** Payload sự kiện `DeviceDisconnected`. */
export interface DeviceDisconnectedEvent {
  readonly connectionId: string;

  readonly reason: DisconnectReason;
}

/** Hàm của native module `DeviceModule` (Android). */
export interface DeviceModuleApi {
  discover(type: NativeDiscoverableType): Promise<NativeDeviceInfo[]>;

  connect(address: NativeDeviceAddress): Promise<NativeConnectedDevice>;

  /** Ghi đủ toàn bộ byte trong `timeoutMs`, không thì reject. */
  write(connectionId: string, base64Data: string, timeoutMs: number): Promise<void>;

  /** Trả ngay khi có ít nhất 1 byte (base64, tối đa `maxBytes`); hết `timeoutMs` mà chưa có byte → `null`. */
  read(connectionId: string, maxBytes: number, timeoutMs: number): Promise<string | null>;

  disconnect(connectionId: string): Promise<void>;
}

export type Unsubscribe = () => void;

/** Đọc `NativeModules.DeviceModule` lúc gọi (không lúc import) để test thay được native module. */
export const DeviceModule: DeviceModuleApi = {
  discover: (type) => NativeModules.DeviceModule.discover(type),
  connect: (address) => NativeModules.DeviceModule.connect(address),
  write: (connectionId, base64Data, timeoutMs) => NativeModules.DeviceModule.write(connectionId, base64Data, timeoutMs),
  read: (connectionId, maxBytes, timeoutMs) => NativeModules.DeviceModule.read(connectionId, maxBytes, timeoutMs),
  disconnect: (connectionId) => NativeModules.DeviceModule.disconnect(connectionId),
};

/**
 * Nghe sự kiện mất kết nối. Dùng `DeviceEventEmitter` toàn cục vì native module không cài
 * `addListener`/`removeListeners`, bọc `NativeEventEmitter` sẽ bị React Native cảnh báo.
 */
export const subscribeDeviceDisconnected = (callback: (event: DeviceDisconnectedEvent) => void): Unsubscribe => {
  const subscription = DeviceEventEmitter.addListener(DEVICE_DISCONNECTED_EVENT, callback);
  return () => subscription.remove();
};
```

**File: `src/features/printer/adapters/native/NativeConnectionPool.ts`**

```ts
import {
  DeviceModule,
  subscribeDeviceDisconnected,
  type DeviceDisconnectedEvent,
  type DeviceModuleApi,
  type NativeConnectedDevice,
  type NativeDeviceAddress,
  type Unsubscribe,
} from './DeviceModule';

/** Quyền dùng một kết nối native; `release()` chỉ có tác dụng ở lần gọi đầu. */
export interface NativeConnectionLease {
  readonly connectionId: string;

  readonly serialNumber: string | null;

  release(): Promise<void>;
}

/** Số nơi đang dùng một kết nối; mỗi lần kết nối mới là một đối tượng mới để lease cũ không trừ nhầm. */
interface ConnectionUsage {
  count: number;
}

type DisconnectSubscriber = (callback: (event: DeviceDisconnectedEvent) => void) => Unsubscribe;

/**
 * Nơi duy nhất đếm số máy in đang dùng chung một kết nối native: người đầu tiên mở, người cuối cùng đóng.
 * Mọi `acquire`/`release` chạy tuần tự để `release` không đóng một kết nối mà `acquire` khác vừa nhận về.
 */
export class NativeConnectionPool {
  private readonly usageByConnectionId = new Map<string, ConnectionUsage>();

  /** Chuỗi việc tuần tự; luôn resolve để một việc lỗi không chặn việc sau. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly deviceModule: DeviceModuleApi = DeviceModule,
    subscribe: DisconnectSubscriber = subscribeDeviceDisconnected,
  ) {
    subscribe((event) => this.usageByConnectionId.delete(event.connectionId));
  }

  acquire(address: NativeDeviceAddress): Promise<NativeConnectionLease> {
    return this.enqueue(() => this.acquireNow(address));
  }

  private async acquireNow(address: NativeDeviceAddress): Promise<NativeConnectionLease> {
    const connected = await this.deviceModule.connect(address);
    const usage = this.usageByConnectionId.get(connected.connectionId) ?? { count: 0 };
    usage.count += 1;
    this.usageByConnectionId.set(connected.connectionId, usage);
    return this.createLease(connected, usage);
  }

  private createLease(connected: NativeConnectedDevice, usage: ConnectionUsage): NativeConnectionLease {
    let released = false;

    return {
      connectionId: connected.connectionId,
      serialNumber: connected.serialNumber,
      release: () => {
        if (released) {
          return Promise.resolve();
        }

        released = true;
        return this.enqueue(() => this.releaseNow(connected.connectionId, usage));
      },
    };
  }

  /** Kết nối đã mất (sự kiện native) hoặc đã mở lại thành phiên mới thì lease cũ không còn gì để trả. */
  private async releaseNow(connectionId: string, usage: ConnectionUsage): Promise<void> {
    if (this.usageByConnectionId.get(connectionId) !== usage) {
      return;
    }

    usage.count -= 1;

    if (usage.count > 0) {
      return;
    }

    this.usageByConnectionId.delete(connectionId);
    await this.deviceModule.disconnect(connectionId);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

export const nativeConnectionPool = new NativeConnectionPool();
```

**File: `src/features/printer/adapters/native/toPrinterError.ts`**

```ts
import { PrinterErrorCode, PrinterErrorException } from '../../errors/PrinterError';

/** Mã lỗi `DeviceModule` (native) → mã lỗi máy in và thông báo hiển thị cho người dùng. */
const NATIVE_ERRORS: Record<string, { code: PrinterErrorCode; message: string }> = {
  INVALID_ARGUMENT: { code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thông tin kết nối máy in không hợp lệ' },
  DEVICE_NOT_FOUND: { code: PrinterErrorCode.PRINTER_NOT_FOUND, message: 'Không tìm thấy máy in' },
  AMBIGUOUS_DEVICE: {
    code: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
    message: 'Có nhiều máy in USB cùng loại, chưa xác định được máy cần dùng',
  },
  PERMISSION_DENIED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền dùng máy in' },
  BLUETOOTH_DISABLED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Bluetooth đang tắt' },
  CONNECTION_FAILED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không kết nối được máy in' },
  NOT_CONNECTED: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' },
  CONNECTION_LOST: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Mất kết nối máy in' },
  SERVICE_CLOSED: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' },
  WRITE_FAILED: { code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: 'Gửi dữ liệu tới máy in thất bại' },
  WRITE_TIMEOUT: { code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: 'Máy in không nhận hết dữ liệu kịp thời' },
  READ_NOT_SUPPORTED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Máy in không hỗ trợ đọc phản hồi' },
  READ_FAILED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không đọc được phản hồi máy in' },
};

const nativeCodeOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
};

/** Lỗi không mang mã native (lỗi lập trình, lỗi lạ) giữ `UNKNOWN_ERROR` kèm thông báo gốc. */
export const toPrinterError = (error: unknown): PrinterErrorException => {
  const nativeCode = nativeCodeOf(error);
  const mapped = nativeCode ? NATIVE_ERRORS[nativeCode] : undefined;

  if (mapped) {
    return new PrinterErrorException({ code: mapped.code, message: mapped.message, cause: error });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new PrinterErrorException({ code: PrinterErrorCode.UNKNOWN_ERROR, message, cause: error });
};
```

**File: `src/features/printer/adapters/native/NativeAdapter.ts`**

```ts
import { Buffer } from 'buffer';
import { NativeModules, Platform } from 'react-native';
import type { IPrinterAdapter, PrinterConnectTarget, PrinterPrintTextOptions } from '../IPrinterAdapter';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import type { PrinterDevice } from '../../models/printer/PrinterDevice';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { DeviceModule, type NativeDeviceAddress, type NativeDeviceInfo } from './DeviceModule';
import { nativeConnectionPool, type NativeConnectionLease } from './NativeConnectionPool';
import { toPrinterError } from './toPrinterError';
import * as EPToolkit from './utils/EPToolkit';

/** Hạn cho một lần ghi; ảnh tem/bill lớn qua Bluetooth (~10 KB/s) cần vài chục giây. */
const WRITE_TIMEOUT_MS = 30_000;

/** Phản hồi lệnh dò của máy in (vd TSPL `~!T`) chỉ vài chục byte. */
const READ_MAX_BYTES = 1_024;

/** Bỏ tag định dạng khi gửi thẳng text sang PrinterSDK (iOS). */
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

const toNativeDiscoverableType = (connectionType: PrinterConnectionType): 'usb' | 'bluetooth' =>
  connectionType === PrinterConnectionType.Usb ? 'usb' : 'bluetooth';

/** USB giữ `deviceId` dạng `vendorId:productId` như dữ liệu đã lưu; Bluetooth dùng MAC làm `deviceId`. */
const toPrinterDevice = (device: NativeDeviceInfo): PrinterDevice => {
  if (device.type === 'bluetooth') {
    return { deviceId: device.address.mac, displayName: device.name ?? '', rawDevice: { ...device.address } };
  }

  const { address } = device;
  return {
    deviceId: `${address.vendorId}:${address.productId}`,
    displayName: device.name ?? '',
    rawDevice: {
      vendorId: address.vendorId,
      productId: address.productId,
      serialNumber: address.serialNumber,
      devicePath: address.devicePath,
      manufacturerName: device.manufacturerName,
      productName: device.productName,
    },
  };
};

const missingTarget = (message: string): PrinterErrorException =>
  new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message });

const notConnected = (): PrinterErrorException =>
  new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });

const toNativeAddress = (target: PrinterConnectTarget): NativeDeviceAddress => {
  if (target.connectionType === PrinterConnectionType.Usb) {
    if (!target.usb) {
      throw missingTarget('Thiếu thông tin thiết bị USB');
    }

    const { vendorId, productId, serialNumber } = target.usb;
    return { type: 'usb', vendorId, productId, serialNumber: serialNumber ?? null, devicePath: null };
  }

  if (target.connectionType === PrinterConnectionType.Bluetooth) {
    if (!target.bluetooth) {
      throw missingTarget('Chưa chọn thiết bị Bluetooth');
    }

    return { type: 'bluetooth', mac: target.bluetooth.deviceId };
  }

  if (!target.lan) {
    throw missingTarget('Thiếu cấu hình IP/Port');
  }

  return { type: 'lan', host: target.lan.ip, port: target.lan.port };
};

/** Gọi native và đổi mã lỗi native sang `PrinterErrorException` có thông báo tiếng Việt. */
const callNative = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    throw toPrinterError(error);
  }
};

/**
 * `IPrinterAdapter` chạy qua native module `DeviceModule` (Android). Kết nối dùng chung qua `nativeConnectionPool`:
 * hai máy in đã lưu cùng một thiết bị chỉ mở một kết nối, kết nối đóng khi máy in cuối cùng ngắt.
 */
export class NativeAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;

  readonly canRead = true;

  private connectionType?: PrinterConnectionType;

  private lease?: NativeConnectionLease;

  async listDevices(connectionType: PrinterConnectionType): Promise<PrinterDevice[]> {
    if (connectionType === PrinterConnectionType.Lan) {
      return [];
    }

    const devices = await callNative(() => DeviceModule.discover(toNativeDiscoverableType(connectionType)));
    return devices.map(toPrinterDevice);
  }

  async connect(target: PrinterConnectTarget): Promise<void> {
    const address = toNativeAddress(target);
    this.connectionType = target.connectionType;
    this.lease = await callNative(() => nativeConnectionPool.acquire(address));
  }

  /** Mã kết nối native trả về lúc `connect`, để driver đối chiếu sự kiện mất kết nối; `null` khi chưa kết nối. */
  getConnectionId(): string | null {
    return this.lease?.connectionId ?? null;
  }

  async write(bytes: Uint8Array): Promise<void> {
    const connectionId = this.requireConnectionId();
    const base64 = Buffer.from(bytes).toString('base64');
    await callNative(() => DeviceModule.write(connectionId, base64, WRITE_TIMEOUT_MS));
  }

  async printText(text: string, options: PrinterPrintTextOptions): Promise<void> {
    if (!this.connectionType) {
      throw notConnected();
    }

    if (Platform.OS === 'ios' && this.connectionType !== PrinterConnectionType.Usb) {
      return this.printTextLegacyIOS(text);
    }

    const connectionId = this.requireConnectionId();
    await callNative(() => DeviceModule.write(connectionId, textTo64Base64(text, options), WRITE_TIMEOUT_MS));
  }

  /** Trả byte nhận được ngay khi có, hoặc `null` khi hết `timeoutMs` mà máy in chưa trả lời. */
  async read(timeoutMs: number): Promise<Uint8Array | null> {
    const connectionId = this.requireConnectionId();
    const base64 = await callNative(() => DeviceModule.read(connectionId, READ_MAX_BYTES, timeoutMs));
    return base64 === null ? null : new Uint8Array(Buffer.from(base64, 'base64'));
  }

  async disconnect(): Promise<void> {
    const lease = this.lease;
    this.lease = undefined;
    this.connectionType = undefined;

    if (lease) {
      await callNative(() => lease.release());
    }
  }

  private requireConnectionId(): string {
    if (!this.lease) {
      throw notConnected();
    }

    return this.lease.connectionId;
  }

  /** Native iOS chưa có `DeviceModule`; giữ lệnh gọi module in cũ của iOS. */
  private printTextLegacyIOS(text: string): Promise<void> {
    const legacyModule =
      this.connectionType === PrinterConnectionType.Bluetooth ? NativeModules.RNBLEPrinter : NativeModules.RNNetPrinter;
    const processed = textPreprocessingIOS(text);

    return new Promise((resolve, reject) => {
      legacyModule.printRawData(processed.text, processed.opts, () => resolve(), (error: Error) => reject(error));
    });
  }
}
```

**File: `src/features/printer/adapters/testing/MockPrinterAdapter.ts`**

```ts
/**
 * Test double dùng chung cho adapters/ trong unit test — thay vì mỗi file
 * test tự viết lại `jest.fn()` boilerplate cho từng adapter. KHÔNG dùng cho
 * production code (chỉ import được từ file test, phụ thuộc global `jest`).
 */
export const createMockDeviceModule = () => ({
  discover: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue({ connectionId: 'mock-connection', serialNumber: null }),
  write: jest.fn().mockResolvedValue(undefined),
  read: jest.fn().mockResolvedValue(null),
  disconnect: jest.fn().mockResolvedValue(undefined),
});

/** Mock của subscribeDeviceDisconnected — trả về unsubscribe rỗng, không tự bắn event nào. */
export const createMockSubscribeDeviceDisconnected = () => jest.fn().mockReturnValue(() => undefined);
```

- [ ] **Step 4: Sửa driver, adapter, hook, jest setup** — lưu script rồi chạy `node task7-edits.js .` ở gốc repo.

**Script: `task7-edits.js`**

```js
// Dùng: node <script> <đường dẫn gốc repo NDTCore.App>. Thiếu đoạn cũ ở đâu thì dừng và báo, không sửa dở.
const fs = require('fs');
const path = require('path');
const base = process.argv[2];

function applyEdits(edits) {
  const updates = [];

  for (const [relative, pairs] of Object.entries(edits)) {
    const file = path.join(base, relative);
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    let text = raw.replace(/\r\n/g, '\n');

    for (const [from, to] of pairs) {
      if (!text.includes(from)) {
        throw new Error('Không thấy đoạn cần sửa trong ' + relative + ':\n' + from.slice(0, 200));
      }

      text = text.replace(from, to);
    }

    updates.push([file, crlf ? text.replace(/\n/g, '\r\n') : text]);
  }

  for (const [file, text] of updates) {
    fs.writeFileSync(file, text);
  }

  console.log('Đã sửa ' + updates.length + ' file');
}

const driverSubscribeOld = `    subscribeConnectionLost((identity) => {
      for (const [printerId, knownIdentity] of this.identities) {
        if (knownIdentity === identity) {
          this.setStatus(printerId, PrinterStatus.Disconnected);
        }
      }
    });`;
const driverSubscribeNew = `    subscribeDeviceDisconnected((event) => {
      for (const [printerId, connectionId] of this.connectionIds) {
        if (connectionId === event.connectionId) {
          this.setStatus(printerId, PrinterStatus.Disconnected);
        }
      }
    });`;

applyEdits({
  'src/features/printer/drivers/escpos/EscPosDriver.ts': [
    ["import { subscribeConnectionLost } from '../../adapters/native/PrinterNativeModule';",
     "import { subscribeDeviceDisconnected } from '../../adapters/native/DeviceModule';"],
    ['  private identities = new Map<string, string>();', '  private connectionIds = new Map<string, string>();'],
    [driverSubscribeOld, driverSubscribeNew],
    ['      const identity = adapter.getConnectionIdentity();\n\n      if (identity) {\n        this.identities.set(printer.id, identity);\n      }',
     '      const connectionId = adapter.getConnectionId();\n\n      if (connectionId) {\n        this.connectionIds.set(printer.id, connectionId);\n      }'],
    ['      this.identities.delete(printerId);', '      this.connectionIds.delete(printerId);'],
    ['    // KHÔNG dùng adapter.printText() — cần chunk qua UsbTransport như TSPL bitmap\n    // (printText() trên USB gọi thẳng writeByBase64 không chunk, bill dài dễ vượt 1 lần transfer).\n',
     '    // Ghi byte bitmap đã encode; printText() chỉ dành cho text có tag định dạng.\n'],
  ],
  'src/features/printer/drivers/tspl/TsplDriver.ts': [
    ["import { subscribeConnectionLost } from '../../adapters/native/PrinterNativeModule';",
     "import { subscribeDeviceDisconnected } from '../../adapters/native/DeviceModule';"],
    ['  private identities = new Map<string, string>();', '  private connectionIds = new Map<string, string>();'],
    [driverSubscribeOld, driverSubscribeNew],
    ['        const identity = (adapter as NativeAdapter).getConnectionIdentity();\n\n        if (identity) {\n          this.identities.set(printer.id, identity);\n        }',
     '        const connectionId = (adapter as NativeAdapter).getConnectionId();\n\n        if (connectionId) {\n          this.connectionIds.set(printer.id, connectionId);\n        }'],
    ['      this.identities.delete(printerId);', '      this.connectionIds.delete(printerId);'],
  ],
  'src/features/printer/adapters/IPrinterAdapter.ts': [
    [' * - `native`  — native module tự viết (`PrinterNativeModule` → `ThermalPrinterModule`)', ' * - `native`  — native module tự viết (`DeviceModule`)'],
    ['  usb?: { vendorId: number; productId: number };', '  usb?: { vendorId: number; productId: number; serialNumber?: string };'],
    ['   * `true` nếu `read()` thực sự đọc được phản hồi từ máy in. `false` (native —\n   * chỉ bulk-OUT) thì caller KHÔNG được ghi lệnh dò (`~!T`…) rồi chờ đọc —\n   * `TsplDriver.identify()` phải trả `null` ngay, không ghi.',
     '   * `true` nếu `read()` đọc được phản hồi từ máy in. `false` thì caller KHÔNG được ghi lệnh dò (`~!T`…) rồi chờ\n   * đọc — `TsplDriver.identify()` phải trả `null` ngay, không ghi.'],
    ['  return { printerId: printer.id, connectionType: connection.type, usb: { vendorId: connection.vendorId, productId: connection.productId } };',
     '  const { vendorId, productId, serialNumber } = connection;\n  return { printerId: printer.id, connectionType: connection.type, usb: { vendorId, productId, serialNumber } };'],
  ],
  'src/features/printer/adapters/resolvePrinterAdapter.ts': [
    [" * - **TSPL / USB**: `NativeAdapter` — ghi byte thô qua `ThermalPrinterModule` (USB không đọc được, `identify` vẫn `null`).",
     ' * - **TSPL / USB**: `NativeAdapter` — ghi/đọc byte thô qua native module `DeviceModule`.'],
  ],
  'src/features/printer/connection/PrinterConnectionLock.ts': [
    [`/**
 * Resource key phải phản ánh đúng RANH GIỚI CONCURRENCY THẬT của lớp bên
 * dưới, không phải định danh vật lý của printer (spec §9, invariant #14):
 *
 * - USB: \`ThermalPrinterModule\` là native module singleton dùng chung giữa CẢ 2
 *   driver — 1 key toàn cục \`"usb"\` bất kể protocol.
 * - ESC/POS qua Bluetooth/LAN: native module \`ThermalPrinterModule\` (qua
 *   \`adapters/native/PrinterNativeModule\`) giữ đúng 1 kết nối / namespace,
 *   singleton TOÀN CỤC theo connectionType — KHÔNG theo
 *   device. Thu hẹp xuống per-device sẽ tái tạo lại bug multi-printer đã
 *   fix trước đây (2 job tưởng độc lập nhưng cướp kết nối lẫn nhau).
 * - TSPL qua Bluetooth/LAN: \`TsplDriver\` tự quản lý transport riêng theo
 *   printerId (không qua thư viện singleton) — an toàn để thu hẹp xuống
 *   per-connection, cho phép 2 máy TSPL khác nhau in song song thật.
 */`,
     `/**
 * Khoá lệnh in: mỗi key chỉ chạy một lệnh in tại một thời điểm, vì một lệnh in gồm nhiều lần gọi native mà native
 * chỉ giữ đúng thứ tự từng lần gọi, không giữ trọn vẹn cả lệnh in.
 *
 * Key hiện thô hơn mức cần: USB dùng chung \`"usb"\`, ESC/POS Bluetooth/LAN dùng chung theo loại kết nối, nên hai máy
 * khác nhau cùng loại in lần lượt thay vì song song — vẫn an toàn. TSPL Bluetooth/LAN đi qua transport thư viện riêng
 * từng máy nên đã khoá theo từng kết nối.
 */`],
  ],
  'src/features/printer/models/printer/PrinterDevice.ts': [
    ['  serialNumber?: string | null;\n}', '  serialNumber?: string | null;\n  /** Đường dẫn thiết bị trong lần cắm hiện tại (vd `/dev/bus/usb/001/004`); không lưu. */\n  devicePath?: string | null;\n}'],
    ['/**\n * Hình dạng `PrinterDevice.rawDevice` khi `connectionType === PrinterConnectionType.Usb` — khớp\n * `PrinterInfoDto` từ native',
     '/**\n * Hình dạng `PrinterDevice.rawDevice` khi `connectionType === PrinterConnectionType.Usb` — dựng từ\n * `NativeUsbDeviceInfo`'],
  ],
  'src/features/printer/hooks/addPrinter/useConnectionSetup.ts': [
    ["import { ThermalPrinterModule } from '../../adapters/native/PrinterNativeModule';\n",
     "import { DeviceModule } from '../../adapters/native/DeviceModule';\n"],
    ['  /**\n   * `UsbDevice.serialNumber` chỉ đọc được sau khi user cấp quyền USB (bấm "Kết\n   * nối") — lúc scan trả `null`. Gọi lại enumerate sau khi connect thành công\n   * để identityKey pin thêm serial (`usb:<vid>:<pid>:<serial>`) thay vì chỉ `vid:pid`.\n   */',
     '  /**\n   * Serial USB chỉ đọc được sau khi người dùng cấp quyền (bấm "Kết nối") — lúc quét trả `null`. Quét lại sau khi\n   * kết nối thành công và khớp đúng máy theo đường dẫn thiết bị để identityKey có serial\n   * (`usb:<vid>:<pid>:<serial>`); khớp theo vendorId/productId sẽ lấy nhầm khi có 2 máy cùng model.\n   */'],
    ["    if (raw.serialNumber) {\n      return;\n    }\n\n    const devices = await ThermalPrinterModule.discoverPrinters(PrinterConnectionType.Usb).catch(() => []);\n    const rich = devices.find((d) => d.vendorId === Number(raw.vendorId) && d.productId === Number(raw.productId));\n\n    if (!rich?.serialNumber) {\n      return;\n    }\n\n    setSelectedDevice((prev) => (prev ? { ...prev, rawDevice: { ...prev.rawDevice, serialNumber: rich.serialNumber } } : prev));",
     "    if (raw.serialNumber || !raw.devicePath) {\n      return;\n    }\n\n    const devices = await DeviceModule.discover('usb').catch(() => []);\n    const match = devices.find((device) => device.type === 'usb' && device.address.devicePath === raw.devicePath);\n    const serialNumber = match?.type === 'usb' ? match.address.serialNumber : null;\n\n    if (!serialNumber) {\n      return;\n    }\n\n    setSelectedDevice((prev) => (prev ? { ...prev, rawDevice: { ...prev.rawDevice, serialNumber } } : prev));"],
  ],
  'jest.setup.js': [
    [`// Lớp JS của native module RN*Printer (adapters/native/PrinterNativeModule)
// gọi thẳng NativeModules.ThermalPrinterModule, nên bất kỳ test nào
// transitively import EscPosDriver.ts / UsbTransport.ts — kể cả không chạy —
// đều fail nếu không mock ở đây. Test cần kiểm soát chi tiết (EscPosDriver.test.ts,
// UsbTransport.test.ts...) override bằng jest.mock() cục bộ, ưu tiên hơn.
jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue('mock-identity'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('Print SuccessFully'),
  },
  subscribeConnectionLost: jest.fn().mockReturnValue(() => undefined),
}));

// PrinterNativeModule.test.ts dùng requireActual để test bản THẬT — cần
// NativeModules.ThermalPrinterModule tồn tại vì RN jest preset không có.
{
  const { NativeModules } = require('react-native');
  NativeModules.ThermalPrinterModule = {
    ...NativeModules.ThermalPrinterModule,
    connect: jest.fn().mockResolvedValue('mock-identity'),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  };
}`,
     `// Lớp JS của native module DeviceModule (adapters/native/DeviceModule) gọi thẳng NativeModules.DeviceModule, nên
// bất kỳ test nào transitively import NativeAdapter — kể cả không chạy — đều fail nếu không mock ở đây. Test cần
// kiểm soát chi tiết override bằng jest.mock() cục bộ, ưu tiên hơn.
jest.mock('./src/features/printer/adapters/native/DeviceModule', () => ({
  DeviceModule: {
    discover: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue({ connectionId: 'mock-connection', serialNumber: null }),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(null),
    disconnect: jest.fn().mockResolvedValue(undefined),
  },
  subscribeDeviceDisconnected: jest.fn().mockReturnValue(() => undefined),
}));

// Pool dùng chung là singleton: bộ đếm của test này sẽ lọt sang test sau. Mặc định thay bằng bản đi thẳng — mỗi
// acquire gọi native connect, mỗi release gọi native disconnect. NativeConnectionPool.test.ts dùng bản thật.
jest.mock('./src/features/printer/adapters/native/NativeConnectionPool', () => ({
  nativeConnectionPool: {
    acquire: async (address) => {
      const { DeviceModule } = jest.requireMock('./src/features/printer/adapters/native/DeviceModule');
      const connected = await DeviceModule.connect(address);
      return { ...connected, release: () => DeviceModule.disconnect(connected.connectionId) };
    },
  },
}));

// DeviceModule.test.ts dùng requireActual để test bản THẬT — cần NativeModules.DeviceModule tồn tại vì RN jest preset
// không có.
{
  const { NativeModules } = require('react-native');
  NativeModules.DeviceModule = {
    discover: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue({ connectionId: 'mock-connection', serialNumber: null }),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(null),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
}`],
  ],
});
```

- [ ] **Step 5: Đổi test driver sang API mới** — lưu script rồi chạy `node convert-driver-tests.js .`. Script in `LEFTOVER … printerId: ble` / `printerId: usb` là bình thường (dữ liệu kỳ vọng của `PrinterLogger`); bất kỳ `LEFTOVER` nào khác là lỗi — dừng task.

**Script: `convert-driver-tests.js`**

```js
const fs = require('fs');
const path = require('path');
const base = process.argv[2];

function load(relative) {
  const file = path.join(base, relative);
  const raw = fs.readFileSync(file, 'utf8');
  return { file, crlf: raw.includes('\r\n'), text: raw.replace(/\r\n/g, '\n') };
}

function save(doc) {
  fs.writeFileSync(doc.file, doc.crlf ? doc.text.replace(/\n/g, '\r\n') : doc.text);
}

function replaceExact(doc, from, to) {
  if (!doc.text.includes(from)) throw new Error('missing in ' + doc.file + ': ' + from.slice(0, 90));
  doc.text = doc.text.replace(from, to);
}

function applyCommonRules(doc) {
  doc.text = doc.text
    .replace(/writeByBase64\(printerId, \.\.\.\)/g, 'write(connectionId, ...)')
    .replace(/'\.\.\/\.\.\/\.\.\/adapters\/native\/PrinterNativeModule'/g, "'../../../adapters/native/DeviceModule'")
    .replace(/\bThermalPrinterModule\b/g, 'DeviceModule')
    .replace(/\bwriteByBase64\b/g, 'write')
    .replace(/\bdiscoverPrinters\b/g, 'discover')
    .replace(/\bsubscribeConnectionLost\b/g, 'subscribeDeviceDisconnected')
    .replace(/as \(identity: string\) => void;/g, 'as (event: { connectionId: string; reason: string }) => void;')
    .replace(/onConnectionLost\('mock-identity'\)/g, "onConnectionLost({ connectionId: 'mock-connection', reason: 'usb_detached' })")
    .replace(/onConnectionLost\('([^']+)'\)/g, "onConnectionLost({ connectionId: '$1', reason: 'usb_detached' })")
    .replace(/mockResolvedValueOnce\('(USB:[^']+)'\)/g, "mockResolvedValueOnce({ connectionId: '$1', serialNumber: null })")
    .replace(/\{ printerId: [\w.]+, type: 'lan', /g, "{ type: 'lan', ")
    .replace(/\{ printerId: [\w.]+, type: 'bluetooth', address: ('[^']+') \}/g, "{ type: 'bluetooth', mac: $1 }")
    .replace(
      /\{ printerId: [\w.]+, type: 'usb', vendorId: (\d+), productId: (\d+) \}/g,
      "{ type: 'usb', vendorId: $1, productId: $2, serialNumber: null, devicePath: null }")
    .replace(/\.write\)\.toHaveBeenCalledWith\(\w+\.id, expect\.any\(String\)\)/g,
      ".write).toHaveBeenCalledWith('mock-connection', expect.any(String), expect.any(Number))")
    .replace(/const \[printerId, base64\] = DeviceModule\.write\.mock\.calls\[0\] as \[string, string\];\n(\s*)expect\(printerId\)\.toBe\(\w+\.id\);/g,
      "const [connectionId, base64] = DeviceModule.write.mock.calls[0] as [string, string, number];\n$1expect(connectionId).toBe('mock-connection');")
    .replace(/DeviceModule\.write\.mock\.calls\[0\] as \[string, string\];/g, 'DeviceModule.write.mock.calls[0] as [string, string, number];')
    .replace(/DeviceModule\.disconnect\)\.toHaveBeenCalledWith\(\w+\.id\)/g, "DeviceModule.disconnect).toHaveBeenCalledWith('mock-connection')")
    .replace(/\.discover\)\.toHaveBeenCalledWith\(PrinterConnectionType\.Bluetooth\)/g, ".discover).toHaveBeenCalledWith('bluetooth')");
}

const escPos = load('src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts');
replaceExact(escPos, `// EscPosDriver đi qua NativeAdapter (không mock) → ThermalPrinterModule
// (adapters/native/PrinterNativeModule), gọi thẳng theo printerId (không còn
// namespace USBPrinter/BLEPrinter/NetPrinter). USB đi qua UsbTransport (cũng
// không mock) — cùng dùng ThermalPrinterModule nên mock 1 chỗ là đủ.
jest.mock('../../../adapters/native/PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue('mock-identity'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  },
  subscribeConnectionLost: jest.fn().mockReturnValue(() => undefined),
}));`, `// EscPosDriver đi qua NativeAdapter (không mock) → DeviceModule (adapters/native/DeviceModule), mọi loại kết nối
// cùng một native module nên mock 1 chỗ là đủ. Pool dùng chung dùng bản đi thẳng trong jest.setup.js.
jest.mock('../../../adapters/native/DeviceModule', () => ({
  DeviceModule: {
    discover: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue({ connectionId: 'mock-connection', serialNumber: null }),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(null),
    disconnect: jest.fn().mockResolvedValue(undefined),
  },
  subscribeDeviceDisconnected: jest.fn().mockReturnValue(() => undefined),
}));`);
replaceExact(escPos, `// \`NativeAdapter.printText\` (dùng bởi EscPosDriver) có nhánh iOS gọi thẳng
// NativeModules.RN*Printer cũ (native iOS chưa implement kiến trúc printerId
// mới — ngoài phạm vi Android-only, xem NativeAdapter.ts). Jest preset RN mặc
// định Platform.OS='ios' — ép 'android' để test đúng nhánh ThermalPrinterModule
// thật sự chạy trên thiết bị.`, `// \`NativeAdapter.printText\` (dùng bởi EscPosDriver) có nhánh iOS gọi module in cũ của iOS. Jest preset RN mặc
// định Platform.OS='ios' — ép 'android' để test đúng nhánh DeviceModule chạy trên thiết bị.`);
applyCommonRules(escPos);
save(escPos);

const tspl = load('src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts');
const failingUsbTransport = `    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    UsbTransport.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('usb connect failed')),
      write: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }));`;
const failingNativeConnect = `    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { connect: jest.Mock } };
    DeviceModule.connect.mockRejectedValueOnce(new Error('usb connect failed'));`;
replaceExact(tspl, `jest.mock('../../../transports/UsbTransport', () => ({
  UsbTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue('mock-identity'),
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));
`, '');
tspl.text = tspl.text.split(failingUsbTransport).join(failingNativeConnect);
replaceExact(tspl, "  it('connect() over USB rejects and sets status error when UsbTransport.connect() fails', async () => {",
  "  it('connect() over USB rejects and sets status error when native connect fails', async () => {");
replaceExact(tspl, `    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { connect: jest.Mock };
    expect(instance.connect).toHaveBeenCalledWith(usbLabelPrinter.id, 1155, 22222);`,
`    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { connect: jest.Mock } };
    expect(DeviceModule.connect).toHaveBeenCalledWith({ type: 'usb', vendorId: 1155, productId: 22222, serialNumber: null, devicePath: null });`);
const usbWriteThroughOld = `    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { write: jest.Mock };`;
const usbWriteThroughNew = `    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { write: jest.Mock } };`;
tspl.text = tspl.text.split(usbWriteThroughOld).join(usbWriteThroughNew);
replaceExact(tspl, "  it('testPrint() over USB writes through UsbTransport', async () => {\n    const driver = new TsplDriver();\n    await driver.connect(usbReceiptPrinter);\n" + usbWriteThroughNew + "\n    await driver.testPrint(usbReceiptPrinter, sampleDocuments);\n    expect(instance.write).toHaveBeenCalled();",
  "  it('testPrint() over USB writes through DeviceModule', async () => {\n    const driver = new TsplDriver();\n    await driver.connect(usbReceiptPrinter);\n" + usbWriteThroughNew + "\n    await driver.testPrint(usbReceiptPrinter, sampleDocuments);\n    expect(DeviceModule.write).toHaveBeenCalled();");
replaceExact(tspl, "  it('print() over USB writes through UsbTransport', async () => {\n    const driver = new TsplDriver();\n    await driver.connect(usbReceiptPrinter);\n" + usbWriteThroughNew + "\n    await driver.print(usbReceiptPrinter.id, sampleDocuments);\n    expect(instance.write).toHaveBeenCalled();",
  "  it('print() over USB writes through DeviceModule', async () => {\n    const driver = new TsplDriver();\n    await driver.connect(usbReceiptPrinter);\n" + usbWriteThroughNew + "\n    await driver.print(usbReceiptPrinter.id, sampleDocuments);\n    expect(DeviceModule.write).toHaveBeenCalled();");
applyCommonRules(tspl);
save(tspl);

for (const doc of [escPos, tspl]) {
  for (const leftover of ['PrinterNativeModule', 'ThermalPrinterModule', 'UsbTransport', 'writeByBase64', 'mock-identity', 'printerId: usb', 'printerId: ble']) {
    if (doc.text.includes(leftover)) console.log('LEFTOVER', path.basename(doc.file), leftover);
  }
}
console.log('ok');
```

- [ ] **Step 6: Xoá file cũ**

```bash
git rm -q src/features/printer/adapters/native/PrinterNativeModule.ts
git rm -q src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts
git rm -q src/features/printer/transports/UsbTransport.ts
git rm -q src/features/printer/transports/__tests__/UsbTransport.test.ts
```

- [ ] **Step 7: Verify** — ở gốc repo:
  - `npx tsc --noEmit` → 0 lỗi.
  - `npx jest` → toàn bộ pass (989 test, 136 suite).
  - `npx eslint src/features/printer jest.setup.js` → 0 lỗi (2 cảnh báo có sẵn trong `transports/__tests__`).
  - `node check-style.js src/features/printer/adapters/native/DeviceModule.ts src/features/printer/adapters/native/NativeConnectionPool.ts src/features/printer/adapters/native/toPrinterError.ts src/features/printer/adapters/native/NativeAdapter.ts src/features/printer/adapters/testing/MockPrinterAdapter.ts src/features/printer/adapters/native/__tests__/DeviceModule.test.ts src/features/printer/adapters/native/__tests__/NativeConnectionPool.test.ts src/features/printer/adapters/native/__tests__/toPrinterError.test.ts src/features/printer/adapters/native/__tests__/NativeAdapter.test.ts src/features/printer/adapters/testing/__tests__/MockPrinterAdapter.test.ts` → không in gì.

- [ ] **Step 8: Commit** (file xoá đã được `git rm` stage)

```bash
git add src/features/printer/adapters/native/DeviceModule.ts
git add src/features/printer/adapters/native/NativeConnectionPool.ts
git add src/features/printer/adapters/native/toPrinterError.ts
git add src/features/printer/adapters/native/NativeAdapter.ts
git add src/features/printer/adapters/testing/MockPrinterAdapter.ts
git add src/features/printer/adapters/native/__tests__/DeviceModule.test.ts
git add src/features/printer/adapters/native/__tests__/NativeConnectionPool.test.ts
git add src/features/printer/adapters/native/__tests__/toPrinterError.test.ts
git add src/features/printer/adapters/native/__tests__/NativeAdapter.test.ts
git add src/features/printer/adapters/testing/__tests__/MockPrinterAdapter.test.ts
git add src/features/printer/drivers/escpos/EscPosDriver.ts
git add src/features/printer/drivers/tspl/TsplDriver.ts
git add src/features/printer/adapters/IPrinterAdapter.ts
git add src/features/printer/adapters/resolvePrinterAdapter.ts
git add src/features/printer/connection/PrinterConnectionLock.ts
git add src/features/printer/models/printer/PrinterDevice.ts
git add src/features/printer/hooks/addPrinter/useConnectionSetup.ts
git add jest.setup.js
git add src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts
git add src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts
git commit -m "feat: move printer adapters to DeviceModule with shared connection pool" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: MAC viết hoa trong `identityKey`, cập nhật tài liệu

**Files:**
- Modify (script): `src/features/printer/discovery/PrinterResolver.ts`
- Modify (script): `src/features/printer/discovery/__tests__/PrinterResolver.test.ts`
- Modify (script): `CLAUDE.md`
- Modify (script): `docs/CODING_STANDARDS.md`
- Modify (script): `src/features/printer/ARCHITECTURE.md`

- [ ] **Step 1: Áp thay đổi (gồm test mới cho MAC viết hoa)** — lưu script rồi chạy `node task8-edits.js .` ở gốc repo.

**Script: `task8-edits.js`**

```js
// Dùng: node <script> <đường dẫn gốc repo NDTCore.App>. Thiếu đoạn cũ ở đâu thì dừng và báo, không sửa dở.
const fs = require('fs');
const path = require('path');
const base = process.argv[2];

function applyEdits(edits) {
  const updates = [];

  for (const [relative, pairs] of Object.entries(edits)) {
    const file = path.join(base, relative);
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    let text = raw.replace(/\r\n/g, '\n');

    for (const [from, to] of pairs) {
      if (!text.includes(from)) {
        throw new Error('Không thấy đoạn cần sửa trong ' + relative + ':\n' + from.slice(0, 200));
      }

      text = text.replace(from, to);
    }

    updates.push([file, crlf ? text.replace(/\n/g, '\r\n') : text]);
  }

  for (const [file, text] of updates) {
    fs.writeFileSync(file, text);
  }

  console.log('Đã sửa ' + updates.length + ' file');
}

applyEdits({
  'src/features/printer/discovery/PrinterResolver.ts': [
    ['    return `bluetooth:mac:${connection.deviceId}`;', '    return `bluetooth:mac:${connection.deviceId.toUpperCase()}`;'],
  ],
  'src/features/printer/discovery/__tests__/PrinterResolver.test.ts': [
    [
      "  it('builds a bluetooth:mac:<deviceId> key for Bluetooth', () => {\n    expect(resolveIdentityKey(buildBluetoothConnection(btDevice))).toBe('bluetooth:mac:00:11:22:33:44:55');\n  });\n",
      "  it('builds a bluetooth:mac:<deviceId> key for Bluetooth', () => {\n    expect(resolveIdentityKey(buildBluetoothConnection(btDevice))).toBe('bluetooth:mac:00:11:22:33:44:55');\n  });\n\n  it('viết hoa MAC trong key Bluetooth để cùng thiết bị luôn ra cùng key', () => {\n    const lowercaseDevice: PrinterDevice = { deviceId: 'aa:bb:cc:dd:ee:ff', displayName: 'Máy in BT', rawDevice: {} };\n    expect(resolveIdentityKey(buildBluetoothConnection(lowercaseDevice))).toBe('bluetooth:mac:AA:BB:CC:DD:EE:FF');\n  });\n",
    ],
  ],
  'CLAUDE.md': [
    [
      '  - **`adapters/native/NativeAdapter`** — qua `PrinterNativeModule` (`RN{USB,BLE,Net}Printer`, code Kotlin/Java ở `android/app/src/main/java/com/ndtcorepos/thermalprinter/`; gốc copy từ `@poriyaalar/react-native-thermal-receipt-printer`, chỉ-Android). `read()` LUÔN `null` (native chỉ bulk-OUT). USB `write` chunk 16KB qua `UsbTransport`.',
      '  - **`adapters/native/NativeAdapter`** — qua native module `DeviceModule` (`adapters/native/DeviceModule.ts`; code Java ở `android/app/src/main/java/com/ndtcorepos/` — `bridge/` là cầu nối React Native, `device/` là tầng thiết bị; chỉ-Android). Native chỉ nhận địa chỉ thiết bị và trả `connectionId`; đọc/ghi USB, Bluetooth, LAN; kết nối dùng chung qua `NativeConnectionPool`. Thiết kế: `docs/superpowers/specs/2026-10-01-native-printer-transport-design.md`.',
    ],
    [
      '- **Java native** (`android/app/src/main/java/com/ndtcorepos/thermalprinter/`): xem',
      '- **Java native** (`android/app/src/main/java/com/ndtcorepos/`): xem',
    ],
  ],
  'docs/CODING_STANDARDS.md': [
    [
      'Áp dụng cho code Java trong `android/app/src/main/java/com/ndtcorepos/thermalprinter/`.',
      'Áp dụng cho code Java trong `android/app/src/main/java/com/ndtcorepos/`.',
    ],
    [
      'với tiền tố `I` để phân biệt rõ với class ngay khi đọc — vd `IPrinterDevice`,\n`IPrinterConnection`, `IPrinterWriter`, `ICapabilityDetector`, `IPrinterDiscovery`. Class\nimplement không mang tiền tố này (`UsbPrinterDevice implements IPrinterDevice`).',
      'với tiền tố `I` để phân biệt rõ với class ngay khi đọc — vd `ITransport`,\n`ITransportFactory`, `IDeviceDiscovery`, `IDisconnectMonitor`, `IDisconnectListener`. Class\nimplement không mang tiền tố này (`UsbTransport implements ITransport`).',
    ],
    [
      '                && UsbPrinterDiscovery.isPrintableUsbDevice(candidate)) {',
      '                && UsbDiscovery.findPrinterInterface(candidate) != null) {',
    ],
    [
      '22. Name interfaces with an `I` prefix (.NET-style, e.g. `IPrinterDevice`); implementing classes carry no such prefix.',
      '22. Name interfaces with an `I` prefix (.NET-style, e.g. `ITransport`); implementing classes carry no such prefix.',
    ],
  ],
  'src/features/printer/ARCHITECTURE.md': [
    [
      '│   │   ├── PrinterNativeModule.ts\n',
      '│   │   ├── DeviceModule.ts\n│   │   ├── NativeConnectionPool.ts\n│   │   ├── toPrinterError.ts\n',
    ],
  ],
});
```

- [ ] **Step 2: Verify**
  - `npx jest src/features/printer/discovery` → 36 test pass (có test "viết hoa MAC…").
  - `npx jest` → 990 test pass.
  - Không còn tên cũ trong code/tài liệu đang dùng: `git grep -n -E "thermalprinter|ThermalPrinterModule|getConnectionIdentity|PrinterNativeModule" -- . ':!docs/superpowers' ':!.superpowers'` → không có kết quả.
  - `cd android && ./gradlew :app:compileDebugJavaWithJavac :app:cleanTestDebugUnitTest :app:testDebugUnitTest -q` → 53 test pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/discovery/PrinterResolver.ts
git add src/features/printer/discovery/__tests__/PrinterResolver.test.ts
git add CLAUDE.md
git add docs/CODING_STANDARDS.md
git add src/features/printer/ARCHITECTURE.md
git commit -m "docs: point docs at the new native device layer; uppercase Bluetooth MAC in identity key" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Kiểm tra trên máy thật (người dùng thực hiện)

Không giao subagent. Build `npm run android` lên máy POS thật và chạy danh sách ở spec §14 "Kiểm tra trên máy thật" (11 mục). Ghi kết quả từng mục vào mô tả PR; lỗi nào phát hiện thì mở task sửa riêng trên branch này.

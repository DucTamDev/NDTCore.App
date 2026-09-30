# NDTCore Java Coding Rules (Android native)

Áp dụng cho code Java trong `android/app/src/main/java/com/ndtcorepos/thermalprinter/`.
Mục tiêu: **readability, consistency, maintainability, low cognitive load**.

Tư tưởng chính: `Explicit > Clever`, `Readable > Short`, `Flat > Nested`, `Intent > Implementation`.

## 1. General Principles

### Rule 1.1 — Readability over brevity

Ưu tiên code dễ đọc hơn code ít dòng.

```java
// Good
String key = buildDeviceKey(device);

Runnable listener = listeners.get(key);
```

Không cố viết:

```java
// Avoid
Runnable listener = listeners.get(buildDeviceKey(device));
```

### Rule 1.2 — Prefer explicit code

Khi có nhiều bước logic, thể hiện rõ từng bước.

```java
UsbDevice device = getDetachedDevice(intent);

if (device == null) {
    return;
}

String key = buildDeviceKey(device);

Runnable listener = listeners.get(key);

if (listener == null) {
    return;
}

listener.run();
```

### Rule 1.3 — Code should be easy to scan

Một method nên có flow nhìn từ trên xuống dưới:

```text
Validate
  ↓
Prepare
  ↓
Execute
  ↓
Return
```

---

## 2. Method Calls

### Rule 2.1 — Avoid nested method calls

Không lồng method call nếu làm giảm readability.

**Avoid**

```java
map.get(buildKey(device.getVendorId(), device.getProductId()));
```

**Prefer**

```java
int vendorId = device.getVendorId();
int productId = device.getProductId();

String key = buildKey(vendorId, productId);

Runnable listener = map.get(key);
```

### Rule 2.2 — Avoid deep method chains

**Avoid**

```java
printer.getConnection().getDevice().getUsbDevice().getVendorId();
```

**Prefer**

```java
Connection connection = printer.getConnection();
Device device = connection.getDevice();
UsbDevice usbDevice = device.getUsbDevice();

int vendorId = usbDevice.getVendorId();
```

Nếu chain dài thường xuyên xuất hiện, xem xét lại object design.

---

## 3. Conditional Statements

### Rule 3.1 — Prefer guard clauses

**Avoid**

```java
if (device != null) {
    if (isSupported(device)) {
        connect(device);
    }
}
```

**Prefer**

```java
if (device == null) {
    return;
}

if (!isSupported(device)) {
    return;
}

connect(device);
```

### Rule 3.2 — No unnecessary `else` after `return`

**Avoid**

```java
if (granted) {
    handleGranted();
    return;
} else {
    handleDenied();
}
```

**Prefer**

```java
if (granted) {
    handleGranted();
    return;
}

handleDenied();
```

### Rule 3.3 — Maximum nesting depth

**Maximum:** 2 levels. **Preferred:** 0–1 level.

Refactor nesting sâu bằng guard clause hoặc extract method.

### Rule 3.4 — Avoid complex boolean expressions

**Avoid**

```java
if (device != null
        && hasPermission(device)
        && isSupported(device)
        && !isBusy(device)
        && isConnected(device)) {
    connect(device);
}
```

**Prefer**

```java
if (device == null) {
    return;
}

if (!isSupported(device)) {
    return;
}

if (!hasPermission(device)) {
    return;
}

if (isBusy(device)) {
    return;
}

if (!isConnected(device)) {
    return;
}

connect(device);
```

---

## 4. Blank Lines & Spacing

### Rule 4.1 — Blank line separates logical blocks

```java
UsbDevice device = getDetachedDevice(intent);

if (device == null) {
    return;
}

String key = buildDeviceKey(device);

Runnable listener = listeners.get(key);

if (listener == null) {
    return;
}

listener.run();
```

Mỗi block có một responsibility.

### Rule 4.2 — Do not add blank lines between related statements

Nếu 2 statement cùng thuộc một operation, không tách blank line giữa chúng:

```java
String key = buildDeviceKey(device);
Runnable listener = listeners.get(key);

log.debug("listener found");
```

### Rule 4.3 — Blank line before a new logical operation

```java
String key = buildDeviceKey(device);
Runnable listener = listeners.get(key);

if (listener == null) {
    return;
}

listener.run();
```

### Rule 4.4 — Do not over-space code

Một blank line là đủ giữa các block — không chèn blank line bên trong 1 block ngắn (vd giữa `if` và `return` của cùng guard clause).

---

## 5. Long Expressions

### Rule 5.1 — Break long method calls

```java
connect(
    device,
    timeout,
    keepConnection,
    retryCount,
    cancellationToken
);
```

### Rule 5.2 — Break long conditions

Nếu condition dài trở nên khó đọc, **extract method** thay vì tiếp tục xuống dòng:

```java
if (!canConnect(device)) {
    return;
}

connect(device);
```

---

## 6. Variables

### Rule 6.1 — Use meaningful names

**Avoid:** `k`, `r`, `d`. **Prefer:** `deviceKey`, `detachListener`, `device`.

### Rule 6.2 — Do not abbreviate unnecessarily

**Avoid:** `UsbDev`, `Conn`, `Req`, `Res`. **Prefer:** `UsbDevice`, `Connection`, `Request`, `Response`.

Các abbreviation phổ biến như `id`, `url`, `api`, `usb`, `ip` vẫn được phép.

### Rule 6.3 — Avoid meaningless temporary variables

> **Extract a variable when it improves readability, naming, debugging, or reuse.**

Không tạo variable chỉ để tránh 1 method call đơn giản nếu context đã đủ rõ.

---

## 7. Methods

### Rule 7.1 — One method, one responsibility

```java
private void handleDeviceDetached(Intent intent) {
    UsbDevice device = getDetachedDevice(intent);

    if (device == null) {
        return;
    }

    Runnable listener = findDetachListener(device);

    if (listener == null) {
        return;
    }

    listener.run();
}
```

### Rule 7.2 — Avoid excessively long methods

Không có giới hạn số dòng cứng, nhưng nếu method có nhiều logical block (validate/parse/lookup/transform/connect/write/retry/handle error/cleanup) → tách method.

### Rule 7.3 — Method names should describe intent

**Avoid:** `process()`, `handle()`, `doIt()`, `execute()`, `run()`.
**Prefer:** `requestUsbPermission()`, `handleDeviceDetached()`, `findDetachListener()`.

---

## 8. Classes

### Rule 8.1 — One primary responsibility per class

Không gộp nhiều mối quan tâm (permission + discovery + transfer + monitoring) vào 1 class.

### Rule 8.2 — Keep dependencies explicit

Constructor nên thể hiện rõ dependency, không lấy qua service locator/global state.

### Rule 8.3 — Interface đặt tên với tiền tố `I`

Theo quy ước .NET (`IDisposable`, `IEnumerable`), mọi interface trong package này đặt tên
với tiền tố `I` để phân biệt rõ với class ngay khi đọc — vd `IPrinterDevice`,
`IPrinterConnection`, `IPrinterWriter`, `ICapabilityDetector`, `IPrinterDiscovery`. Class
implement không mang tiền tố này (`UsbPrinterDevice implements IPrinterDevice`).

---

## 9. Constants

### Rule 9.1 — No magic values

```java
private static final int DEFAULT_TIMEOUT_MS = 5_000;
```

### Rule 9.2 — Constants should express intent

**Avoid:** `VALUE = 5000`. **Prefer:** `USB_WRITE_TIMEOUT_MS = 5_000`.

---

## 10. Null Handling

### Rule 10.1 — Handle null immediately

```java
if (device == null) {
    return;
}
```

### Rule 10.2 — Avoid unnecessary null checks

Nếu contract đảm bảo non-null, không lặp lại null check ở mọi method — chỉ check tại boundary nơi dữ liệu có thể thực sự null.

---

## 11. Collections

### Rule 11.1 — Prefer interface types

```java
private final Map<String, Runnable> listeners = new HashMap<>();
```

### Rule 11.2 — Name collections by what they contain

**Avoid:** `data`. **Prefer:** `deviceDetachListeners`.

---

## 12. Exceptions

### Rule 12.1 — Never silently swallow exceptions

Nếu intentionally ignore, phải có lý do rõ ràng (comment giải thích why).

### Rule 12.2 — Preserve context when logging errors

```java
try {
    connect();
} catch (Exception exception) {
    Log.e(LOG_SOURCE, "usb.connect.failed deviceKey=" + deviceKey, exception);
    throw exception;
}
```

---

## 13. Logging

### Rule 13.1 — Every class has `LOG_SOURCE`, không dùng `TAG`

```java
private static final String LOG_SOURCE = "UsbPermission";
```

### Rule 13.2 — Structured, consistent message format

Format: `<hành động>: <key>=<value>` (không trộn lẫn style có/không dấu hai chấm giữa các log trong cùng codebase).

```java
Log.v(LOG_SOURCE, "receiver registered");
Log.v(LOG_SOURCE, "permission result: granted=" + granted);
Log.i(LOG_SOURCE, "bulk transfer result: " + result);
```

---

## 14. Comments

### Rule 14.1 — Code should explain how; comments explain why

Không comment lại điều code đã nói rõ. Chỉ comment khi có lý do business/technical không hiển nhiên.

### Rule 14.2 — Do not comment obvious code

### Rule 14.3 — Comment at function boundary, not per Android API call

Function trực tiếp dùng Android Framework API nên có Javadoc mô tả **trách
nhiệm Android/platform** của function (enumerate devices, open hardware
resource, claim/release resource, register/unregister listener, request
permission, xử lý tương thích SDK level...) — đặt comment ở function, không
rải comment trên từng dòng API call bên trong. Comment viết bằng **tiếng
Việt**, nhất quán với toàn bộ comment còn lại trong codebase.

```java
/**
 * Tìm thiết bị máy in USB hiện có qua UsbManager của Android.
 */
private UsbDevice findCandidate() {
    if (usbManager == null) {
        return null;
    }

    for (UsbDevice candidate : usbManager.getDeviceList().values()) {
        if (candidate.getVendorId() == vendorId
                && candidate.getProductId() == productId
                && UsbPrinterDiscovery.isPrintableUsbDevice(candidate)) {
            return candidate;
        }
    }

    return null;
}
```

Không phải mọi function đụng Android API đều bắt buộc có Javadoc:

```text
Function trực tiếp dùng Android API
        │
        ├── Function responsibility cần giải thích
        │       → Comment/Javadoc
        │
        └── Behavior đã hoàn toàn rõ từ tên + code
                → Không cần comment
```

Ví dụ **không cần** comment vì tên + code đã đủ rõ, không tự gọi Android API:

```java
private boolean isOpen() {
    return deviceConnection != null && claimedInterface != null;
}

UsbDeviceConnection getDeviceConnection() {
    return deviceConnection;
}
```

---

## 15. Formatting

### Rule 15.1 — Braces always required

Không viết `if (x) return;` trên 1 dòng không có `{}`.

### Rule 15.2 — One statement per line

### Rule 15.3 — Keep indentation consistent

---

## 16. Boolean

### Rule 16.1 — Boolean names should be readable

**Avoid:** `permission`, `state`, `check`. **Prefer:** `hasPermission`, `isConnected`, `isSupported`, `shouldRetry`.

### Rule 16.2 — Avoid double negatives

**Avoid:** `!isNotSupported(device)`. **Prefer:** `isSupported(device)` hoặc `!isSupported(device)`.

---

## 17. Ternary Operator

### Rule 17.1 — Simple ternary is allowed

```java
String mode = enabled ? "enabled" : "disabled";
```

### Rule 17.2 — No nested ternary

Dùng `if`, `switch`, hoặc method riêng thay vì `a ? "A" : b ? "B" : "C"`.

---

## 18. Switch

Với nhiều mutually exclusive case, ưu tiên `switch` thay vì chuỗi `if/else`.

```java
switch (connectionType) {
    case USB:
        return usbTransport;
    case BLUETOOTH:
        return bluetoothTransport;
    case LAN:
        return lanTransport;
    default:
        throw new UnsupportedOperationException("Unsupported connection type: " + connectionType);
}
```

---

## 19. Early Return vs Multiple Returns

Multiple returns **được phép** — mục tiêu là giảm nesting, không phải giảm số lượng `return`.

```java
private Runnable findListener(UsbDevice device) {
    if (device == null) {
        return null;
    }

    String key = buildDeviceKey(device);

    return listeners.get(key);
}
```

---

## 20. Final Recommended Style

```java
private void handleDeviceDetached(Intent intent) {
    UsbDevice device = getDetachedDevice(intent);

    if (device == null) {
        return;
    }

    String deviceKey = buildDeviceKey(device);

    Runnable listener = deviceDetachListeners.get(deviceKey);

    if (listener == null) {
        return;
    }

    listener.run();
}
```

## Coding Standard — bản tóm tắt (đã đưa vào `CLAUDE.md`)

1. Prefer readability over brevity.
2. Prefer explicit steps over compact expressions.
3. Avoid nested method calls when they reduce readability.
4. Avoid deep method chains.
5. Prefer guard clauses and early returns.
6. Do not use `else` after `return`.
7. Keep conditional nesting at a maximum of two levels.
8. Use blank lines to separate logical blocks.
9. Do not use blank lines between closely related statements.
10. Break long expressions and method calls across multiple lines.
11. Use meaningful, intent-revealing variable and method names.
12. Avoid unnecessary temporary variables.
13. Keep methods focused on a single responsibility.
14. Avoid magic values; use named constants.
15. Avoid complex boolean expressions; extract named predicates when necessary.
16. Always use braces for control statements.
17. One statement per line.
18. Use `LOG_SOURCE` for Android logging; do not use `TAG`.
19. Comments should explain **why**, not obvious **what**.
20. Prefer maintainable and debuggable code over clever or overly compact code.
21. Comment functions that directly use Android APIs at the function level (Android/platform responsibility) — not on individual API calls; skip when the name + code already make it obvious.
22. Name interfaces with an `I` prefix (.NET-style, e.g. `IPrinterDevice`); implementing classes carry no such prefix.

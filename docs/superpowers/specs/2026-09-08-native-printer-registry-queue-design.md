# NDTCore POS — Native Android Printer Layer v2 (Registry + Queue)

Thay thế toàn bộ kiến trúc native hiện tại (`ThermalPrinterModule` → `PrinterService` →
`IPrinterTransport` theo `ConnectionType`, 1 device active/loại) bằng model hỗ trợ
**nhiều printer cùng loại kết nối song song**, mỗi printer có hàng đợi in riêng.

Spec này tự đầy đủ — không cần đọc `refactor-native-android-design.md` (doc tham khảo ban
đầu) để hiểu hay implement.

---

## 1. Mục tiêu & phạm vi

Native chịu trách nhiệm:

- Quản lý danh sách printer đang hoạt động (`PrinterRegistry`).
- Kết nối/ngắt kết nối, ghi raw bytes.
- USB/Bluetooth/LAN transport, permission Android (USB).
- Discovery thiết bị theo từng loại kết nối.
- Detect capability quan sát được từ native (không đoán).
- Hàng đợi FIFO riêng cho từng printer, chạy song song giữa các printer.
- Timeout, cancellation, chuẩn hoá error, expose `Promise` cho React Native.

Native **không** chịu trách nhiệm: ESC/POS, TSPL, receipt/label rendering, font, layout,
protocol detection, business logic Base64 (decode Base64 do bridge làm, nhưng ý nghĩa nội
dung bytes không phải việc của native).

Native **không** đụng tới `PrintScheduler`/`PrinterConnectionLock`/`resourceKey` hiện có ở
JS (`src/features/printer/services/printing/PrintScheduler.ts`). Hai hệ thống hàng đợi
(native theo `printerId`, JS theo `resourceKey` tính từ driver+connection) tồn tại song
song trong đợt này — việc gộp/bỏ bớt 1 bên là quyết định của 1 spec sau.

---

## 2. Nguyên tắc kiến trúc & Dependency Rule

```text
React Native
     │
     ▼
PrinterModule (bridge — Promise, decode Base64)
     │
     ▼
PrinterManager (facade — orchestration)
     │
     ├──────────────┐
     ▼              ▼
PrinterRegistry   PrinterQueueManager
     │              │
     ▼              ▼
PrinterDevice    PrinterQueue (1/printerId, FIFO)
     │              │
     ├──────┐       ▼
     ▼      ▼    PrintJob
Connection Writer
     │      │
     ▼      ▼
Android Platform (UsbManager/BluetoothAdapter/Socket)
```

Dependency chỉ đi 1 chiều: `PrinterModule → PrinterManager → PrinterDevice →
Connection/Writer → Android API`. Không có chiều ngược (Android API không biết
`PrinterManager`; `Connection`/`Writer` không biết ESC/POS/TSPL).

---

## 3. `printerId` — nguồn sinh & vòng đời

**Native là nơi sinh `printerId` cho printer mới**, JS chỉ nhận lại và lưu — đây là điểm
mấu chốt khác với mọi ID khác trong app (job/request id JS tự sinh qua `generateId()`).

```text
Máy in MỚI (JS chưa có id — initialValues rỗng trong useAddPrinterFlow):
  JS  → PrinterModule.connect({ printerId: null, type, vendorId, productId, ... })
  Bridge → printerId null/rỗng → generate UUID mới ("printerId đã sinh")
  Bridge → PrinterManager.connect(printerId đã sinh, info)
  Manager → registry chưa có key này → tạo PrinterDevice mới → registry.put(...)
  Thành công → Bridge resolve Promise với { printerId: "<uuid-mới>", ... }
  JS  → dùng printerId này cho toàn bộ phần còn lại của flow (testPrint, discovery...);
        lúc bấm "Lưu" → PrinterRepository.addPrinter({ id: printerId, ... })

Máy in ĐÃ LƯU (initialValues.id có sẵn, hoặc reconnect sau này):
  JS  → PrinterModule.connect({ printerId: "<id-đã-lưu>", type, vendorId, productId, ... })
  Bridge → printerId có sẵn → dùng nguyên giá trị này, KHÔNG generate mới
  Manager → registry.get(id):
              có rồi → idempotent, dùng lại PrinterDevice hiện có
              chưa có (vd sau khi app bị kill, Registry rỗng) → tạo mới NGAY DƯỚI key đó
```

Quy tắc: việc kiểm tra null/rỗng và generate UUID nằm ở **`PrinterModule` (bridge)**, không
phải `PrinterManager` — `PrinterManager.connect(String printerId, PrinterInfo info)` luôn
nhận `printerId` cụ thể, không bao giờ null. Lý do đặt ở bridge: sinh ID là mối quan tâm của
hợp đồng JS-native (client cần 1 ID để dùng lại), không phải logic nghiệp vụ của
`PrinterManager`.

Nếu `connect()` thất bại (permission denied/device not found/...) thì **không** tạo entry
trong Registry dù đã generate UUID — UUID đó bị bỏ, không trả về, không rò rỉ vào Registry.

`printerId` sinh ở native **không liên quan `identityKey`**. `identityKey` (fingerprint từ
`vendorId:productId:serial` / `mac` / `host:port`, dùng để JS tự chống trùng khi lưu máy in)
là khái niệm thuần JS — native không tính, không biết, không cần biết.

Hệ quả JS: `useAddPrinterFlow.ts` không còn tự `generateId()` cho `printerId` trước khi gọi
native — với printer mới, `printerId` chỉ có được SAU khi `connect()` đầu tiên resolve
thành công.

---

## 4. Package layout

```text
android/app/src/main/java/com/ndtcorepos/thermalprinter/
├── module/
│   ├── PrinterModule.java            (bridge RN — thay ThermalPrinterModule.java)
│   └── PrinterErrorResult.java       (giữ nguyên — Promise.reject có cấu trúc)
├── printer/
│   ├── PrinterManager.java           (facade — thay PrinterService.java)
│   ├── PrinterRegistry.java          (Map<printerId, PrinterDevice>, thread-safe)
│   ├── PrinterDevice.java            (interface — thay model/IPrinterDevice.java cũ)
│   ├── PrinterInfo.java
│   ├── PrinterCapabilities.java
│   ├── CapabilityState.java
│   ├── PrinterState.java
│   └── PrinterResult.java
├── device/
│   ├── UsbPrinterDevice.java         (implements PrinterDevice)
│   ├── BluetoothPrinterDevice.java   (implements PrinterDevice)
│   └── NetPrinterDevice.java         (implements PrinterDevice)
├── transport/
│   ├── PrinterConnection.java        (interface lifecycle thuần — xem mục 6)
│   ├── PrinterWriter.java            (interface — chỉ write bytes)
│   ├── usb/
│   │   ├── UsbConnection.java
│   │   ├── UsbWriter.java
│   │   └── UsbEndpointResolver.java
│   ├── bluetooth/
│   │   ├── BluetoothConnection.java
│   │   └── BluetoothWriter.java
│   └── net/
│       ├── NetConnection.java
│       └── NetWriter.java
├── queue/
│   ├── PrinterQueueManager.java      (Map<printerId, PrinterQueue>)
│   ├── PrinterQueue.java             (FIFO, 1 single-thread executor/queue)
│   ├── PrintJob.java
│   └── PrintJobResult.java
├── discovery/
│   ├── IPrinterDiscovery.java        (giữ tên hiện tại, trả về List<PrinterInfo>)
│   ├── usb/UsbPrinterDiscovery.java  (giữ logic hiện tại — isPrintableUsbDevice,...)
│   └── bluetooth/BluetoothPrinterDiscovery.java (giữ logic hiện tại)
├── detector/
│   ├── CapabilityDetector.java
│   ├── UsbCapabilityDetector.java
│   ├── BluetoothCapabilityDetector.java
│   └── NetCapabilityDetector.java
├── enums/ConnectionType.java          (giữ nguyên — usb/bluetooth/lan)
├── exception/
│   ├── PrinterException.java
│   ├── PrinterConnectionException.java
│   ├── PrinterPermissionException.java
│   ├── PrinterWriteException.java
│   └── PrinterTimeoutException.java
├── error/PrinterErrorCode.java        (giữ chỗ hiện tại, mở rộng danh sách — mục 12)
└── permission/UsbPermission.java      (giữ nguyên, không đổi)
```

**Xoá hoàn toàn**: `model/PrinterConnection.java` (sealed interface data cũ),
`model/IPrinterDevice.java`, `transport/IPrinterTransport.java`,
`application/PrinterService.java`, `application/PrinterServiceFactory.java`,
`module/ThermalPrinterModule.java` (nội dung dời sang `module/PrinterModule.java`).

`getName()` của module RN vẫn trả `"ThermalPrinterModule"` — **tên module phía JS
(`NativeModules.ThermalPrinterModule`) không đổi**, chỉ đổi tên file/class Java.

`UsbPrinterDiscovery`, `BluetoothPrinterDiscovery`, `UsbPermission`,
`UsbPrinterDiscovery.isPrintableUsbDevice/findBulkOutInterface/findBulkOutEndpoint` giữ
nguyên logic — chỉ đổi kiểu trả về (`IPrinterDevice` → `PrinterInfo`) cho khớp model mới.

---

## 5. `PrinterInfo`, `PrinterCapabilities`, `PrinterState`, `PrinterResult`

```java
/** Metadata bất biến mô tả 1 printer. */
public final class PrinterInfo {
    /** ID định danh printer trong Registry. */
    private final String printerId;
    /** Loại kết nối. */
    private final ConnectionType connectionType;
    /** Tên hiển thị (từ hệ điều hành khi discovery, có thể null khi connect thủ công). */
    private final String name;
    /** VID USB — null nếu không phải USB. */
    private final Integer vendorId;
    /** PID USB — null nếu không phải USB. */
    private final Integer productId;
    /** Serial USB nếu thiết bị có báo (không phải mọi USB device đều có). */
    private final String serialNumber;
    /** Địa chỉ MAC Bluetooth — null nếu không phải Bluetooth. */
    private final String bluetoothAddress;
    /** Host/IP mạng — null nếu không phải LAN. */
    private final String host;
    /** Port TCP — null nếu không phải LAN. */
    private final Integer port;
}
```

`PrinterInfo` **không có** field `identityKey`/`resourceKey` — cả 2 đều không phải mối
quan tâm của native (mục 3).

```java
/** Khả năng của printer mà native có thể quan sát được — không mô tả protocol. */
public final class PrinterCapabilities {
    /** Có ghi raw bytes được không (native luôn biết — luôn SUPPORTED nếu connect thành công). */
    private final CapabilityState rawWrite;
    /** Có đọc được trạng thái giấy không. */
    private final CapabilityState paperStatus;
    /** Có đọc được trạng thái nắp máy không. */
    private final CapabilityState coverStatus;
    /** Có đọc được trạng thái tổng quát máy in không. */
    private final CapabilityState printerStatus;
}

/** Mức độ chắc chắn của 1 capability đã detect. */
public enum CapabilityState {
    /** Chắc chắn hỗ trợ. */
    SUPPORTED,
    /** Chắc chắn không hỗ trợ. */
    UNSUPPORTED,
    /** Native không xác định được — KHÔNG suy ra là không hỗ trợ. */
    UNKNOWN
}
```

```java
/** Vòng đời 1 printer trong Registry. */
public enum PrinterState {
    /** Đã có trong Registry, chưa mở kết nối thật. */
    REGISTERED,
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

Transition hợp lệ: `REGISTERED → CONNECTING → {CONNECTED | ERROR}`,
`CONNECTED → DISCONNECTING → DISCONNECTED`, `ERROR`/`DISCONNECTED → CONNECTING` (retry qua
`connect()`/`reconnect()`). Không có transition nào quay lại từ `DISCONNECTED` sang
`CONNECTED` mà không qua `CONNECTING`.

```java
/** Kết quả 1 thao tác native (connect/disconnect/...), không kèm dữ liệu nghiệp vụ. */
public final class PrinterResult {
    private final boolean success;
    private final PrinterErrorCode errorCode;
    private final String message;
    private final long durationMs;

    public static PrinterResult success(long durationMs);
    public static PrinterResult failure(PrinterErrorCode errorCode, String message, long durationMs);
}
```

---

## 6. `PrinterConnection` / `PrinterWriter` — lifecycle thuần, tách khỏi write

Khác code hiện tại (`model/PrinterConnection.java` là sealed interface **chứa data**
`Usb(vendorId,productId)`/`Bluetooth(address)`/`Lan(host,port)` truyền vào `connect()`).
Ở model mới, `PrinterConnection` **không chứa data** — data kết nối là field riêng của
từng implementation, gán 1 lần lúc khởi tạo.

```java
/** Lifecycle của 1 kênh giao tiếp với printer — không ghi dữ liệu. */
public interface PrinterConnection {
    /** Mở kênh giao tiếp. */
    CompletableFuture<PrinterResult> open();
    /** Đóng kênh giao tiếp — gọi nhiều lần không lỗi (idempotent). */
    CompletableFuture<PrinterResult> close();
    /** Kênh có đang mở không. */
    boolean isOpen();
}

/** Ghi raw bytes trên 1 kênh đã mở. */
public interface PrinterWriter {
    /** Ghi bytes — ném lỗi nếu kênh chưa mở hoặc ghi thất bại. */
    CompletableFuture<PrinterResult> write(byte[] data);
}
```

### `UsbConnection` / `UsbWriter` / `UsbEndpointResolver`

```java
/** Quản lý vòng đời kết nối USB — permission, mở/đóng UsbDeviceConnection, claim interface. */
public final class UsbConnection implements PrinterConnection {
    private final UsbManager usbManager;
    private final UsbPermission permission;
    private final int vendorId;
    private final int productId;
    private UsbDevice usbDevice;
    private UsbDeviceConnection connection;
    private UsbInterface claimedInterface;

    @Override public CompletableFuture<PrinterResult> open();
    @Override public CompletableFuture<PrinterResult> close();
    @Override public boolean isOpen();
}

/** Ghi bytes qua bulk OUT endpoint USB. */
public final class UsbWriter implements PrinterWriter {
    private final UsbConnection connection;
    private final UsbEndpointResolver endpointResolver;

    @Override public CompletableFuture<PrinterResult> write(byte[] data);
}

/** Tìm bulk OUT endpoint hợp lệ để ghi dữ liệu tới printer. */
public final class UsbEndpointResolver {
    /** Trả về endpoint OUT — ném PrinterException(USB_ENDPOINT_NOT_FOUND) nếu không có. */
    public UsbEndpoint resolve(UsbDevice device);
}
```

`UsbPermission` (giữ nguyên, không đổi API) tiếp tục sở hữu `BroadcastReceiver` cho
`ACTION_USB_PERMISSION`/`ACTION_USB_DEVICE_DETACHED`; permission vẫn bất đồng bộ —
`UsbConnection.open()` gọi `requestPermission()` rồi trả `CompletableFuture` chờ callback,
không block thread bằng `Thread.sleep`.

### `BluetoothConnection` / `BluetoothWriter`

```java
/** Quản lý vòng đời socket RFCOMM Bluetooth. */
public final class BluetoothConnection implements PrinterConnection {
    private final String address;
    private BluetoothSocket socket;

    @Override public CompletableFuture<PrinterResult> open();
    @Override public CompletableFuture<PrinterResult> close();
    @Override public boolean isOpen();
}

/** Ghi bytes qua OutputStream của socket Bluetooth. */
public final class BluetoothWriter implements PrinterWriter {
    private final BluetoothConnection connection;

    @Override public CompletableFuture<PrinterResult> write(byte[] data);
}
```

### `NetConnection` / `NetWriter`

```java
/** Quản lý vòng đời kết nối TCP tới printer mạng. */
public final class NetConnection implements PrinterConnection {
    private final String host;
    private final int port;
    private Socket socket;

    @Override public CompletableFuture<PrinterResult> open();
    @Override public CompletableFuture<PrinterResult> close();
    @Override public boolean isOpen();
}

/** Ghi bytes qua OutputStream TCP. */
public final class NetWriter implements PrinterWriter {
    private final NetConnection connection;

    @Override public CompletableFuture<PrinterResult> write(byte[] data);
}
```

---

## 7. `PrinterDevice` — điều phối Connection + Writer cho 1 printer

```java
/** Đại diện 1 printer cụ thể — điều phối connection/writer, không tự biết protocol. */
public interface PrinterDevice {
    /** Metadata của printer này. */
    PrinterInfo getInfo();
    /** Trạng thái vòng đời hiện tại. */
    PrinterState getState();
    /** Đang kết nối không. */
    boolean isConnected();
    /** Mở kết nối — idempotent nếu đã CONNECTED. */
    CompletableFuture<PrinterResult> connect();
    /** Đóng kết nối — idempotent nếu đã DISCONNECTED. */
    CompletableFuture<PrinterResult> disconnect();
    /** Ghi raw bytes — ném NOT_CONNECTED nếu chưa kết nối (không tự động connect lại). */
    CompletableFuture<PrinterResult> write(byte[] data);
}
```

```java
/** PrinterDevice cho kết nối USB — phối hợp UsbConnection + UsbWriter. */
public final class UsbPrinterDevice implements PrinterDevice { }

/** PrinterDevice cho kết nối Bluetooth — phối hợp BluetoothConnection + BluetoothWriter. */
public final class BluetoothPrinterDevice implements PrinterDevice { }

/** PrinterDevice cho kết nối LAN — phối hợp NetConnection + NetWriter. */
public final class NetPrinterDevice implements PrinterDevice { }
```

Mỗi implementation tự cập nhật `PrinterState` (field nội bộ) theo transition ở mục 5 khi
`connect()`/`disconnect()`/`write()` chạy hoặc thất bại.

---

## 8. `PrinterRegistry` / `PrinterManager`

```java
/** Registry thread-safe các printer đang được native quản lý, khoá theo printerId. */
public final class PrinterRegistry {
    /** Tìm printer theo id — null nếu chưa có. */
    public PrinterDevice get(String printerId);
    /** Thêm/thay thế printer trong registry. */
    public void put(String printerId, PrinterDevice device);
    /** Xoá printer khỏi registry. */
    public void remove(String printerId);
    /** Tất cả printer đang quản lý. */
    public List<PrinterDevice> getAll();
}
```

`PrinterManager` là facade RN gọi qua `PrinterModule`, biết cách dựng đúng loại
`PrinterDevice` (Usb/Bluetooth/Net) từ `PrinterInfo.connectionType` — `Registry` chỉ lưu
trữ, không tự tạo device:

```java
public final class PrinterManager {
    /**
     * Kết nối tới printer theo printerId (đã được bridge đảm bảo không null) + info.
     *
     * <p>Registry chưa có printerId này → tạo PrinterDevice mới theo
     * info.connectionType, put vào Registry, rồi connect(). Đã có → dùng lại
     * PrinterDevice hiện có (idempotent nếu đã CONNECTED).</p>
     */
    public CompletableFuture<PrinterResult> connect(String printerId, PrinterInfo info);

    /** Kết nối lại — lỗi PRINTER_NOT_FOUND nếu printerId không có trong Registry. */
    public CompletableFuture<PrinterResult> reconnect(String printerId);

    /** Đóng kết nối — lỗi PRINTER_NOT_FOUND nếu printerId không có trong Registry. */
    public CompletableFuture<PrinterResult> disconnect(String printerId);

    /** Metadata printer đã đăng ký — null nếu không tìm thấy. */
    public PrinterInfo getInfo(String printerId);

    /** Capability đã detect cho printer — null nếu không tìm thấy. */
    public PrinterCapabilities getCapabilities(String printerId);

    /** Đưa 1 lệnh ghi vào hàng đợi FIFO của printer này. */
    public CompletableFuture<PrintJobResult> write(String printerId, byte[] data);

    /** Huỷ 1 job còn PENDING trong hàng đợi — false nếu job không tồn tại/đã chạy. */
    public boolean cancelJob(String jobId);

    /** Trạng thái hàng đợi hiện tại của 1 printer. */
    public QueueStatus getQueueStatus(String printerId);

    /** Đóng tất cả kết nối + tắt mọi executor — gọi khi RN module bị huỷ. */
    public void shutdown();
}
```

Không có method `register`/`unregister` riêng — `connect()` gánh cả việc tạo/lưu vào
Registry lẫn mở kết nối thật; `disconnect()` là đủ để dọn khi JS xoá 1 printer đã lưu
(Registry giữ entry ở trạng thái `DISCONNECTED`, không tốn tài nguyên đáng kể với số lượng
máy in nhỏ của 1 cửa hàng).

---

## 9. Queue — 1 queue/printerId, không `ResourceLock` riêng

`UsbManager`/`BluetoothAdapter`/`Socket` của Android không có giới hạn kiểu "1 resource
dùng chung cho nhiều device" ở tầng OS — không có tình huống 2 `printerId` khác nhau phải
tranh chấp 1 tài nguyên native chung. Vì vậy **không có khái niệm `ResourceLock` riêng** —
FIFO của `PrinterQueue` (theo `printerId`) là đủ để đảm bảo tuần tự trong 1 printer, song
song giữa các printer khác nhau.

```java
/** 1 lệnh ghi đã được đưa vào hàng đợi. */
public final class PrintJob {
    private final String jobId;
    private final String printerId;
    private final byte[] data;
    private final long createdAt;
}

/** Kết quả cuối cùng của 1 PrintJob. */
public final class PrintJobResult {
    private final String jobId;
    private final String printerId;
    private final boolean success;
    private final PrinterErrorCode errorCode;
    private final String message;
    private final long durationMs;
}

/** Hàng đợi FIFO cho 1 printer — chạy trên 1 single-thread executor riêng. */
public final class PrinterQueue {
    private final String printerId;
    private final ExecutorService executor; // Executors.newSingleThreadExecutor()

    /** Thêm job vào cuối hàng đợi — thực thi đúng thứ tự FIFO. */
    public CompletableFuture<PrintJobResult> enqueue(PrintJob job);
    /** Huỷ job — chỉ thành công nếu job còn PENDING (chưa tới lượt chạy). */
    public boolean cancel(String jobId);
    /** Số job đang chờ + trạng thái job đang chạy (nếu có). */
    public QueueStatus status();
    /** Đóng executor — không nhận job mới. */
    public void shutdown();
}

/** Trạng thái hàng đợi tại 1 thời điểm. */
public final class QueueStatus {
    private final int pendingCount;
    private final String runningJobId; // null nếu queue đang rảnh
}

/** Map printerId → PrinterQueue, tạo lười khi có job đầu tiên cho 1 printerId. */
public final class PrinterQueueManager {
    public PrinterQueue getOrCreate(String printerId);
    public void shutdownAll();
}
```

1 job thất bại (`PrintJobResult.success = false`) **không chặn job kế tiếp** trong cùng
queue — exception được bắt gọn bên trong `enqueue()`'s task, không ném ra khỏi thread của
executor.

**Không tự động retry.** Native không tự ý gửi lại 1 write thất bại — nếu native không biết
printer đã in bao nhiêu byte trước khi mất kết nối, retry mù có thể gây in trùng (duplicate
print). Retry (nếu cần) là quyết định của JS, thực hiện bằng cách gọi lại
`write(printerId, data)` — tự tạo 1 `PrintJob` mới.

---

## 10. Error model

`PrinterErrorCode` (`error/PrinterErrorCode.java`) — danh sách đầy đủ:

```text
NONE, INVALID_ARGUMENT, PRINTER_NOT_FOUND, PRINTER_BUSY,
PERMISSION_DENIED, PERMISSION_REQUIRED, CONNECTION_FAILED, CONNECTION_TIMEOUT,
NOT_CONNECTED, WRITE_FAILED, WRITE_TIMEOUT, USB_DEVICE_NOT_FOUND,
USB_ENDPOINT_NOT_FOUND, USB_INTERFACE_CLAIM_FAILED, BLUETOOTH_DEVICE_NOT_FOUND,
BLUETOOTH_CONNECTION_FAILED, NETWORK_CONNECTION_FAILED, NETWORK_TIMEOUT,
JOB_CANCELLED, UNSUPPORTED_CONNECTION, UNKNOWN_ERROR
```

Không có `PRINTER_ALREADY_REGISTERED` — `connect()` idempotent (tạo mới hoặc dùng lại theo
`printerId`), không có khái niệm "đăng ký trùng" cần báo lỗi riêng. Không có `QUEUE_FULL` —
`PrinterQueue` không giới hạn kích thước (số lệnh in của 1 cửa hàng nhỏ, không cần giới hạn
nhân tạo ở phiên bản này).

```java
/** Gốc exception của tầng native printer — luôn mang errorCode + printerId liên quan. */
public class PrinterException extends Exception {
    private final PrinterErrorCode code;
    private final String printerId; // null nếu lỗi không gắn với 1 printer cụ thể (vd input sai)
    public PrinterErrorCode getCode();
}

/** Lỗi khi mở/đóng kết nối. */
public class PrinterConnectionException extends PrinterException { }

/** Lỗi liên quan permission Android (USB). */
public class PrinterPermissionException extends PrinterException { }

/** Lỗi khi ghi dữ liệu. */
public class PrinterWriteException extends PrinterException { }

/** Vượt quá thời gian chờ (connect/write/socket). */
public class PrinterTimeoutException extends PrinterException { }
```

`PrinterErrorResult` (bridge, `module/PrinterErrorResult.java`) giữ nguyên như hiện tại —
map `PrinterException`/`PrinterErrorCode` sang `promise.reject(code.name(), message)`.

---

## 11. Bridge (`PrinterModule.java`)

```java
/** RN bridge duy nhất cho printer — Promise boundary, sinh printerId cho printer mới. */
public final class PrinterModule extends ReactContextBaseJavaModule {

    /** Liệt kê thiết bị khả dụng cho 1 loại kết nối. */
    @ReactMethod
    public void discoverPrinters(String type, Promise promise);

    /**
     * Kết nối tới printer theo thông tin truyền vào.
     *
     * <p>`printer.printerId` rỗng/null → sinh UUID mới, tạo printer, trả
     * printerId đó trong kết quả. Có sẵn → dùng nguyên giá trị, idempotent
     * nếu đã kết nối.</p>
     */
    @ReactMethod
    public void connect(ReadableMap printer, Promise promise);

    /** Kết nối lại — lỗi nếu printerId không còn trong Registry (đã qua vòng đời process khác). */
    @ReactMethod
    public void reconnect(String printerId, Promise promise);

    /** Đóng kết nối tới printer. */
    @ReactMethod
    public void disconnect(String printerId, Promise promise);

    /** Giải mã Base64 rồi ghi raw bytes — kết nối được giữ nguyên, chỉ đóng khi gọi disconnect(). */
    @ReactMethod
    public void writeByBase64(String printerId, String base64Data, Promise promise);

    /** Lấy metadata của 1 printer đã đăng ký. */
    @ReactMethod
    public void getPrinterInfo(String printerId, Promise promise);

    /** Lấy capability native đã detect cho 1 printer. */
    @ReactMethod
    public void getPrinterCapabilities(String printerId, Promise promise);

    /** Huỷ 1 job còn đang chờ trong hàng đợi. */
    @ReactMethod
    public void cancelPrintJob(String jobId, Promise promise);

    /** Lấy trạng thái hàng đợi hiện tại của 1 printer. */
    @ReactMethod
    public void getQueueStatus(String printerId, Promise promise);
}
```

`connect` — input map (theo `type`):

```text
USB:       { printerId?: string, type: "usb", vendorId: number, productId: number }
Bluetooth: { printerId?: string, type: "bluetooth", address: string }
LAN:       { printerId?: string, type: "lan", host: string, port: number }
```

`connect` — resolve value: `{ printerId: string }` (giá trị truyền vào nếu có, giá trị mới
sinh nếu không). Không có `registerPrinter`/`unregisterPrinter` riêng.

`getName()` tiếp tục trả `"ThermalPrinterModule"` — tên module phía JS không đổi.

---

## 12. Threading & async model

Nội bộ (`PrinterManager` → `PrinterDevice` → `Connection`/`Writer`): `CompletableFuture`.
Boundary `PrinterModule`: `Promise` — map 1-1 từ `CompletableFuture`
(`.thenAccept(result -> promise.resolve(...))` / `.exceptionally(error -> { ...
PrinterErrorResult...rejectTo(promise); return null; })`).

Mỗi `PrinterQueue` sở hữu 1 `Executors.newSingleThreadExecutor()` riêng — I/O luôn chạy
trên thread đó, không bao giờ trên main thread Android hay JS thread.

`PrinterManager.shutdown()` được `PrinterModule.invalidate()` (React Native New
Architecture lifecycle hook) gọi khi module bị huỷ: đóng tất cả `PrinterDevice`, gọi
`PrinterQueueManager.shutdownAll()`.

---

## 13. Discovery & Capability Detection

```java
/** Tìm các printer khả dụng cho 1 loại kết nối. */
public interface IPrinterDiscovery {
    List<PrinterInfo> discover();
}
```

`UsbPrinterDiscovery`/`BluetoothPrinterDiscovery` giữ nguyên logic quét thiết bị hiện tại
(`UsbManager.getDeviceList()`/`BluetoothAdapter` bonded devices), chỉ đổi kiểu trả về từ
`IPrinterDevice` sang `PrinterInfo`. Không có discovery cho LAN — network printer nhập IP
thủ công, đúng như app hiện tại.

Discovery **không** connect printer — chỉ trả về `PrinterInfo`, việc mở kết nối là của
`PrinterDevice.connect()` sau đó.

```java
/** Phát hiện capability quan sát được từ native — không suy đoán, không biết protocol. */
public interface CapabilityDetector {
    PrinterCapabilities detect(PrinterInfo info);
}

public final class UsbCapabilityDetector implements CapabilityDetector { }
public final class BluetoothCapabilityDetector implements CapabilityDetector { }
public final class NetCapabilityDetector implements CapabilityDetector { }
```

Chưa có consumer JS nào gọi `getPrinterCapabilities` ở thời điểm viết spec này — cả 3
detector trả `UNKNOWN` cho mọi field ở phiên bản đầu (hạ tầng sẵn sàng, chưa cắm logic đọc
status thật qua lệnh ESC/POS, việc đó thuộc tầng driver JS).

---

## 14. SOLID

- **SRP**: `PrinterDevice` (vòng đời printer), `Connection` (mở/đóng kênh), `Writer` (ghi
  bytes), `Discovery` (tìm thiết bị), `CapabilityDetector` (capability), `PrinterQueue`
  (thứ tự job), `PrinterRegistry` (lưu trữ) — mỗi lớp 1 việc.
- **OCP**: thêm 1 loại transport mới (vd Serial) chỉ cần thêm `SerialPrinterDevice` +
  `SerialConnection`/`SerialWriter`, không sửa `PrinterManager`/`PrinterQueue`.
- **LSP**: `UsbPrinterDevice`/`BluetoothPrinterDevice`/`NetPrinterDevice` thay thế được cho
  nhau qua interface `PrinterDevice`.
- **ISP**: tách `PrinterConnection`/`PrinterWriter`/`IPrinterDiscovery`/`CapabilityDetector`
  thay vì gộp vào 1 interface `PrinterTransport` khổng lồ.
- **DIP**: `PrinterManager` phụ thuộc `PrinterDevice`/`PrinterRegistry`/`PrinterQueueManager`
  (abstraction), không phụ thuộc `UsbDeviceConnection`/`BluetoothSocket`/`Socket`.

---

## 15. JS-side changes (trong phạm vi plan lần này)

- `PrinterNativeModule.ts`: viết lại theo bridge API mục 11 — địa chỉ hoá theo `printerId`
  thay vì `connectionType`; bỏ `keepConnection` khỏi `PrinterPrintTextOptions` và khỏi
  `printRawDataUsb/Bluetooth/Lan`.
- `IPrinterAdapter.ts`: `PrinterPrintTextOptions` bỏ field `keepConnection`.
- `NativeAdapter.ts`: đổi call site theo API mới.
- `useAddPrinterFlow.ts`: bỏ việc tự `generateId()` cho `printerId` trước khi connect (máy
  in mới) — `printerId` lấy từ response của lệnh `connect()` đầu tiên; giữ nguyên
  `initialValues?.id` khi sửa máy in đã lưu.
- **Không đổi**: `PrintScheduler.ts`, `PrinterConnectionLock.ts`, `resourceKey` — theo đúng
  quyết định ở mục 1.

---

## 16. Comment convention (áp dụng khi implement)

Javadoc public API: 1 dòng, nói đúng chức năng hiện tại — không nhắc gì đến version cũ,
không so sánh "trước đây"/"không còn". Chỉ viết thêm 1-2 dòng giải thích khi có 1 ràng buộc
hoặc hành vi thật sự không hiển nhiên nếu chỉ đọc tên method (vd lý do permission USB bất
đồng bộ ở mục 6, lý do không tự động retry ở mục 9).

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
IPrinterDevice    PrinterQueue (1/printerId, FIFO)
     │              │
     ├──────┐       ▼
     ▼      ▼    PrintJob
Connection Writer
     │      │
     ▼      ▼
Android Platform (UsbManager/BluetoothAdapter/Socket)
```

Dependency chỉ đi 1 chiều: `PrinterModule → PrinterManager → IPrinterDevice →
Connection/Writer → Android API`. Không có chiều ngược (Android API không biết
`PrinterManager`; `Connection`/`Writer` không biết ESC/POS/TSPL).

---

## 3. `printerId` — nguồn sinh & vòng đời

**JS là nơi sinh `printerId` duy nhất** (như mọi ID khác trong app — `generateId()`),
native không bao giờ tự sinh id. `useAddPrinterFlow.ts` giữ nguyên cách sinh
`printerId` hiện tại (`useMemo(() => initialValues?.id ?? generateId(), ...)`, ngay khi mở
flow "Thêm máy in", trước cả lần `connect()` đầu tiên) — không cần sửa thứ tự flow.

```text
JS  → PrinterModule.connect({ printerId: "<id JS đã có sẵn>", type, vendorId, productId, ... })
Bridge → PrinterManager.connect(printerId, info)
Manager → registry.get(printerId):
            có rồi → idempotent, dùng lại IPrinterDevice hiện có
            chưa có (lần đầu, hoặc sau khi app bị kill — Registry rỗng) → tạo
            IPrinterDevice mới, registry.put(printerId, device)
```

`PrinterManager.connect(String printerId, PrinterInfo info)` luôn nhận `printerId` cụ thể,
không bao giờ null — bridge không có bước generate/validate id nào, chỉ truyền thẳng
xuống.

`printerId` **không liên quan `identityKey`**. `identityKey` (fingerprint từ
`vendorId:productId:serial` / `mac` / `host:port`, dùng để JS tự chống trùng khi lưu máy in)
là khái niệm thuần JS — native không tính, không biết, không cần biết.

---

## 4. Package layout

```text
android/app/src/main/java/com/ndtcorepos/thermalprinter/
├── module/
│   ├── PrinterModule.java            (bridge RN — thay ThermalPrinterModule.java)
│   └── PrinterErrorResult.java       (giữ nguyên — Promise.reject có cấu trúc)
├── printer/
│   ├── PrinterManager.java           (facade — thay PrinterService.java)
│   ├── PrinterRegistry.java          (Map<printerId, IPrinterDevice>, thread-safe)
│   ├── IPrinterDevice.java            (interface — thay model/IPrinterDevice.java cũ; đổi tên từ PrinterDevice.java để nhất quán prefix `I` với IPrinterDiscovery)
│   ├── PrinterInfo.java
│   ├── PrinterCapabilities.java
│   ├── CapabilityState.java
│   ├── PrinterState.java
│   └── PrinterResult.java
├── device/
│   ├── UsbPrinterDevice.java         (implements IPrinterDevice)
│   ├── BluetoothPrinterDevice.java   (implements IPrinterDevice)
│   └── NetPrinterDevice.java         (implements IPrinterDevice)
├── transport/
│   ├── IPrinterConnection.java        (interface lifecycle thuần — xem mục 6)
│   ├── IPrinterWriter.java            (interface — chỉ write bytes)
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
│   ├── ICapabilityDetector.java
│   ├── UsbCapabilityDetector.java
│   ├── BluetoothCapabilityDetector.java
│   └── NetCapabilityDetector.java
├── enums/ConnectionType.java          (giữ nguyên — usb/bluetooth/lan)
├── error/
│   ├── PrinterErrorCode.java          (giữ chỗ hiện tại, mở rộng danh sách — mục 10)
│   └── PrinterException.java          (giữ nguyên — root exception, không đổi package)
├── exception/
│   ├── PrinterConnectionException.java
│   ├── PrinterPermissionException.java
│   ├── PrinterWriteException.java
│   └── PrinterTimeoutException.java
└── permission/UsbPermission.java      (giữ nguyên, không đổi)
```

`PrinterException` (root) **giữ nguyên vị trí** ở package `error/` — không di chuyển sang
`exception/`. Lý do: `module/PrinterErrorResult.java` (giữ nguyên, không đổi) import
`error.PrinterException`; nếu di chuyển sẽ phải sửa `PrinterErrorResult` và mọi call site
cùng lúc một cách không cần thiết. 4 exception con (`exception/`) `extends
com.ndtcorepos.thermalprinter.error.PrinterException` — subclass khác package base class là
hợp lệ, không cần base class cùng package.

**Xoá hoàn toàn**: `model/IPrinterConnection.java` (sealed interface data cũ),
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
/**
 * Metadata bất biến mô tả 1 printer.
 */
public final class PrinterInfo {
    /** ID định danh printer trong Registry. */
    private final String printerId;
    /** Loại kết nối. */
    private final ConnectionType connectionType;
    /** Tên hiển thị (từ hệ điều hành khi discovery, có thể null khi connect thủ công). */
    private final String name;
    /** Tên nhà sản xuất USB — null nếu không phải USB/không đọc được. JS dùng cho `Printer.vendor`. */
    private final String manufacturerName;
    /** Tên sản phẩm USB — null nếu không phải USB/không đọc được. JS dùng cho `Printer.model`. */
    private final String productName;
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
/**
 * Khả năng của printer mà native có thể quan sát được — không mô tả protocol.
 */
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

```java
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

Không có state `REGISTERED` — `IPrinterDevice` chỉ được tạo trong `Registry` ngay tại thời
điểm `connect()` được gọi (mục 3), không có bước "đăng ký" tách rời việc mở kết nối, nên
state đầu tiên của 1 device luôn là `CONNECTING`.

Transition hợp lệ: `CONNECTING → {CONNECTED | ERROR}`, `CONNECTED → DISCONNECTING →
DISCONNECTED`, `ERROR`/`DISCONNECTED → CONNECTING` (retry qua `connect()`/`reconnect()`).
Không có transition nào quay lại từ `DISCONNECTED` sang `CONNECTED` mà không qua
`CONNECTING`.

```java
/**
 * Kết quả 1 thao tác native (connect/disconnect/...), không kèm dữ liệu nghiệp vụ.
 */
public final class PrinterResult {
    private final boolean success;
    private final PrinterErrorCode errorCode;
    private final String message;
    private final long durationMs;

    /**
     * Tạo kết quả thành công.
     *
     * @param durationMs thời gian thực hiện thao tác (mili-giây)
     * @return kết quả thành công
     */
    public static PrinterResult success(long durationMs);

    /**
     * Tạo kết quả thất bại.
     *
     * @param errorCode mã lỗi
     * @param message thông điệp lỗi
     * @param durationMs thời gian thực hiện thao tác (mili-giây)
     * @return kết quả thất bại
     */
    public static PrinterResult failure(PrinterErrorCode errorCode, String message, long durationMs);
}
```

---

## 6. `IPrinterConnection` / `IPrinterWriter` — lifecycle thuần, tách khỏi write

Khác code hiện tại (`model/IPrinterConnection.java` là sealed interface **chứa data**
`Usb(vendorId,productId)`/`Bluetooth(address)`/`Lan(host,port)` truyền vào `connect()`).
Ở model mới, `IPrinterConnection` **không chứa data** — data kết nối là field riêng của
từng implementation, gán 1 lần lúc khởi tạo.

```java
/**
 * Lifecycle của 1 kênh giao tiếp với printer — không ghi dữ liệu.
 */
public interface IPrinterConnection {

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

/**
 * Ghi raw bytes trên 1 kênh đã mở.
 */
public interface IPrinterWriter {

    /**
     * Ghi bytes — ném lỗi nếu kênh chưa mở hoặc ghi thất bại.
     *
     * @param data dữ liệu cần ghi
     */
    CompletableFuture<PrinterResult> write(byte[] data);
}
```

### `UsbConnection` / `UsbWriter` / `UsbEndpointResolver`

```java
/**
 * Quản lý vòng đời kết nối USB — permission, mở/đóng UsbDeviceConnection, claim interface.
 */
public final class UsbConnection implements IPrinterConnection {
    private final UsbManager usbManager;
    private final UsbPermission permission;
    private final int vendorId;
    private final int productId;
    private UsbDeviceConnection connection;
    private UsbInterface claimedInterface;

    /**
     * Mở kết nối USB — xin permission nếu chưa có, sau đó claim interface.
     */
    @Override
    public CompletableFuture<PrinterResult> open();

    /**
     * Đóng kết nối USB và release interface.
     */
    @Override
    public CompletableFuture<PrinterResult> close();

    /**
     * Kết nối USB có đang mở không.
     */
    @Override
    public boolean isOpen();
}

/**
 * Ghi bytes qua bulk OUT endpoint USB — tự resolve endpoint từ interface đã
 * claim (Connection chỉ biết interface, không biết endpoint để ghi).
 */
public final class UsbWriter implements IPrinterWriter {
    private final UsbConnection connection;
    private final UsbEndpointResolver endpointResolver;

    /**
     * Ghi bytes qua bulk transfer.
     *
     * @param data dữ liệu cần ghi
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data);
}

/**
 * Tìm bulk OUT endpoint hợp lệ để ghi dữ liệu tới printer.
 */
public final class UsbEndpointResolver {

    /**
     * Tìm endpoint dùng để gửi dữ liệu tới printer.
     *
     * @param device thiết bị USB
     * @return endpoint OUT đã resolve
     * @throws PrinterException USB_ENDPOINT_NOT_FOUND khi không tìm thấy endpoint hợp lệ
     */
    public UsbEndpoint resolve(UsbDevice device);
}
```

`UsbPermission` (giữ nguyên, không đổi API) tiếp tục sở hữu `BroadcastReceiver` cho
`ACTION_USB_PERMISSION`/`ACTION_USB_DEVICE_DETACHED`, cộng thêm
`registerPermissionResultListener`/`unregisterPermissionResultListener` (theo
vendorId/productId, cùng pattern với `registerDeviceDetachListener`) để báo
kết quả dialog cấp quyền cho đúng caller đang đợi — permission vẫn bất đồng
bộ: `UsbConnection.open()` gọi `requestPermission()` rồi trả
`CompletableFuture` chờ callback, không block thread bằng `Thread.sleep`.

**Permission là trách nhiệm của `UsbConnection`** — `UsbPrinterDevice` chỉ
gọi thẳng `connection.open()`, hoàn toàn generic giống Bluetooth/Net, không
biết gì về permission. Từng cân nhắc chuyển permission sang `UsbPrinterDevice`
(tham khảo DantSu — `UsbOutputStream` của họ không xử lý permission ở tầng
transport) nhưng quyết định giữ lại ở `UsbConnection` để đơn giản hoá trước
mắt; việc tách permission ra khỏi `IPrinterConnection` (nếu cần) để lại cho
1 refactor riêng sau này, không làm cùng lúc với redesign này.

### `BluetoothConnection` / `BluetoothWriter`

```java
/**
 * Quản lý vòng đời socket RFCOMM Bluetooth.
 */
public final class BluetoothConnection implements IPrinterConnection {
    private final String address;
    private BluetoothSocket socket;

    /**
     * Mở socket RFCOMM tới địa chỉ Bluetooth đã cấu hình.
     */
    @Override
    public CompletableFuture<PrinterResult> open();

    /**
     * Đóng socket Bluetooth.
     */
    @Override
    public CompletableFuture<PrinterResult> close();

    /**
     * Socket có đang kết nối không.
     */
    @Override
    public boolean isOpen();
}

/**
 * Ghi bytes qua OutputStream của socket Bluetooth.
 */
public final class BluetoothWriter implements IPrinterWriter {
    private final BluetoothConnection connection;

    /**
     * Ghi bytes rồi flush OutputStream.
     *
     * @param data dữ liệu cần ghi
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data);
}
```

### `NetConnection` / `NetWriter`

```java
/**
 * Quản lý vòng đời kết nối TCP tới printer mạng.
 */
public final class NetConnection implements IPrinterConnection {
    private final String host;
    private final int port;
    private Socket socket;

    /**
     * Mở socket TCP tới host/port đã cấu hình.
     */
    @Override
    public CompletableFuture<PrinterResult> open();

    /**
     * Đóng socket TCP.
     */
    @Override
    public CompletableFuture<PrinterResult> close();

    /**
     * Socket có đang kết nối không.
     */
    @Override
    public boolean isOpen();
}

/**
 * Ghi bytes qua OutputStream TCP.
 */
public final class NetWriter implements IPrinterWriter {
    private final NetConnection connection;

    /**
     * Ghi bytes rồi flush OutputStream.
     *
     * @param data dữ liệu cần ghi
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data);
}
```

---

## 7. `IPrinterDevice` — điều phối Connection + Writer cho 1 printer

```java
/**
 * Đại diện 1 printer cụ thể — điều phối connection/writer, không tự biết protocol.
 */
public interface IPrinterDevice {

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
     * @throws PrinterException NOT_CONNECTED nếu chưa kết nối
     */
    CompletableFuture<PrinterResult> write(byte[] data);
}
```

```java
/**
 * IPrinterDevice cho kết nối USB — phối hợp UsbConnection + UsbWriter.
 */
public final class UsbPrinterDevice implements IPrinterDevice { }

/**
 * IPrinterDevice cho kết nối Bluetooth — phối hợp BluetoothConnection + BluetoothWriter.
 */
public final class BluetoothPrinterDevice implements IPrinterDevice { }

/**
 * IPrinterDevice cho kết nối LAN — phối hợp NetConnection + NetWriter.
 */
public final class NetPrinterDevice implements IPrinterDevice { }
```

Mỗi implementation tự cập nhật `PrinterState` (field nội bộ) theo transition ở mục 5 khi
`connect()`/`disconnect()`/`write()` chạy hoặc thất bại.

---

## 8. `PrinterRegistry` / `PrinterManager`

```java
/**
 * Registry thread-safe các printer đang được native quản lý, khoá theo printerId.
 */
public final class PrinterRegistry {

    /**
     * Tìm printer theo id.
     *
     * @param printerId id cần tìm
     * @return printer tương ứng, null nếu chưa có
     */
    public IPrinterDevice get(String printerId);

    /**
     * Thêm/thay thế printer trong registry.
     *
     * @param printerId khoá đăng ký
     * @param device printer cần lưu
     */
    public void put(String printerId, IPrinterDevice device);

    /**
     * Xoá printer khỏi registry.
     *
     * @param printerId id cần xoá
     */
    public void remove(String printerId);

    /**
     * Tất cả printer đang quản lý.
     */
    public List<IPrinterDevice> getAll();
}
```

`PrinterManager` là facade RN gọi qua `PrinterModule`, biết cách dựng đúng loại
`IPrinterDevice` (Usb/Bluetooth/Net) từ `PrinterInfo.connectionType` — `Registry` chỉ lưu
trữ, không tự tạo device:

```java
public final class PrinterManager {

    /**
     * Quét thiết bị khả dụng cho 1 loại kết nối.
     *
     * @param type loại kết nối cần quét
     * @return danh sách printer tìm thấy — rỗng nếu không có discovery cho loại này (LAN)
     * @throws PrinterException DISCOVERY_FAILED nếu hệ thống USB/Bluetooth không sẵn sàng
     */
    public List<PrinterInfo> discover(ConnectionType type) throws PrinterException;

    /**
     * Kết nối tới printer theo printerId (JS truyền vào) + info.
     *
     * <p>Registry chưa có printerId này → tạo IPrinterDevice mới theo
     * info.connectionType, put vào Registry, rồi connect(). Đã có → dùng lại
     * IPrinterDevice hiện có (idempotent nếu đã CONNECTED).</p>
     *
     * @param printerId khoá đăng ký trong Registry
     * @param info thông tin kết nối
     */
    public CompletableFuture<PrinterResult> connect(String printerId, PrinterInfo info);

    /**
     * Kết nối lại 1 printer đã có trong Registry.
     *
     * @param printerId id cần kết nối lại
     * @throws PrinterException PRINTER_NOT_FOUND nếu printerId không có trong Registry
     */
    public CompletableFuture<PrinterResult> reconnect(String printerId);

    /**
     * Đóng kết nối tới 1 printer.
     *
     * @param printerId id cần ngắt kết nối
     * @throws PrinterException PRINTER_NOT_FOUND nếu printerId không có trong Registry
     */
    public CompletableFuture<PrinterResult> disconnect(String printerId);

    /**
     * Metadata của 1 printer đã đăng ký.
     *
     * @param printerId id cần tra cứu
     * @return metadata tương ứng, null nếu không tìm thấy
     */
    public PrinterInfo getInfo(String printerId);

    /**
     * Capability đã detect cho 1 printer.
     *
     * @param printerId id cần tra cứu
     * @return capability tương ứng, null nếu không tìm thấy
     */
    public PrinterCapabilities getCapabilities(String printerId);

    /**
     * Trạng thái kết nối sống hiện tại của printer — nguồn sự thật thật sự,
     * không phải giá trị JS tự suy luận.
     *
     * @param printerId id cần tra cứu
     * @return trạng thái hiện tại, null nếu printerId không có trong Registry
     */
    public PrinterState getConnectionState(String printerId);

    /**
     * Đưa 1 lệnh ghi vào hàng đợi FIFO của printer này.
     *
     * @param printerId printer đích
     * @param data dữ liệu cần ghi
     */
    public CompletableFuture<PrintJobResult> write(String printerId, byte[] data);

    /**
     * Huỷ 1 job còn PENDING trong hàng đợi.
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công, false nếu job không tồn tại/đã chạy
     */
    public boolean cancelJob(String jobId);

    /**
     * Trạng thái hàng đợi hiện tại của 1 printer.
     *
     * @param printerId id cần tra cứu
     */
    public QueueStatus getQueueStatus(String printerId);

    /**
     * Đóng tất cả kết nối và tắt mọi executor — gọi khi RN module bị huỷ.
     */
    public void shutdown();
}
```

Không có method `register`/`unregister` riêng — `connect()` gánh cả việc tạo/lưu vào
Registry lẫn mở kết nối thật; `disconnect()` là đủ để dọn khi JS xoá 1 printer đã lưu
(Registry giữ entry ở trạng thái `DISCONNECTED`, không tốn tài nguyên đáng kể với số lượng
máy in nhỏ của 1 cửa hàng).

`connect()` **không tự so sánh** `info` truyền vào với `info` đã lưu từ lần tạo device
trước đó cho cùng `printerId` — nếu device đã tồn tại, dùng lại nguyên trạng
(idempotent theo mục 3), bỏ qua `info` mới. JS đã tự track trạng thái kết nối
(`usePrinterConnection.ts`/Redux) và tự gọi `disconnect(printerId)` trước khi `connect()`
lại với thông số mới khi sửa máy in (`useAddPrinterFlow.ts` đã gọi
`PrinterConnectionService.disconnectForDriver(...)` lúc cleanup) — native không cần
validate chéo giữa các lần gọi.

---

## 9. Queue — 1 queue/printerId, không `ResourceLock` riêng

`UsbManager`/`BluetoothAdapter`/`Socket` của Android không có giới hạn kiểu "1 resource
dùng chung cho nhiều device" ở tầng OS — không có tình huống 2 `printerId` khác nhau phải
tranh chấp 1 tài nguyên native chung. Vì vậy **không có khái niệm `ResourceLock` riêng** —
FIFO của `PrinterQueue` (theo `printerId`) là đủ để đảm bảo tuần tự trong 1 printer, song
song giữa các printer khác nhau.

```java
/**
 * 1 lệnh ghi đã được đưa vào hàng đợi.
 */
public final class PrintJob {
    /** ID định danh job. */
    private final String jobId;
    /** Printer đích. */
    private final String printerId;
    /** Dữ liệu cần ghi. */
    private final byte[] data;
    /** Thời điểm job được tạo. */
    private final long createdAt;
}

/**
 * Kết quả cuối cùng của 1 PrintJob.
 */
public final class PrintJobResult {
    /** ID job tương ứng. */
    private final String jobId;
    /** Printer đích. */
    private final String printerId;
    /** Job có thành công không. */
    private final boolean success;
    /** Mã lỗi — null nếu thành công. */
    private final PrinterErrorCode errorCode;
    /** Thông điệp lỗi — null nếu thành công. */
    private final String message;
    /** Thời gian thực thi (mili-giây). */
    private final long durationMs;
}

/**
 * Hàng đợi FIFO cho 1 printer — chạy trên 1 single-thread executor riêng.
 */
public final class PrinterQueue {
    private final String printerId;
    private final ExecutorService executor; // Executors.newSingleThreadExecutor()

    /**
     * Thêm job vào cuối hàng đợi — thực thi đúng thứ tự FIFO.
     *
     * @param job job cần thực thi
     */
    public CompletableFuture<PrintJobResult> enqueue(PrintJob job);

    /**
     * Huỷ job — chỉ thành công nếu job còn PENDING (chưa tới lượt chạy).
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công
     */
    public boolean cancel(String jobId);

    /**
     * Số job đang chờ và job đang chạy (nếu có).
     */
    public QueueStatus status();

    /**
     * Đóng executor — không nhận job mới.
     */
    public void shutdown();
}

/**
 * Trạng thái hàng đợi tại 1 thời điểm.
 */
public final class QueueStatus {
    /** Số job đang chờ. */
    private final int pendingCount;
    /** ID job đang chạy — null nếu queue đang rảnh. */
    private final String runningJobId;
}

/**
 * Map printerId → PrinterQueue, tạo lười khi có job đầu tiên cho 1 printerId.
 */
public final class PrinterQueueManager {

    /**
     * Lấy queue của 1 printer, tạo mới nếu chưa có.
     *
     * @param printerId printer cần lấy queue
     * @return queue tương ứng
     */
    public PrinterQueue getOrCreate(String printerId);

    /**
     * Đóng tất cả queue đang quản lý.
     */
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
PERMISSION_DENIED, PERMISSION_REQUIRED, DISCOVERY_FAILED, CONNECTION_FAILED,
CONNECTION_TIMEOUT, NOT_CONNECTED, WRITE_FAILED, WRITE_TIMEOUT, USB_DEVICE_NOT_FOUND,
USB_ENDPOINT_NOT_FOUND, USB_INTERFACE_CLAIM_FAILED, BLUETOOTH_DEVICE_NOT_FOUND,
BLUETOOTH_CONNECTION_FAILED, NETWORK_CONNECTION_FAILED, NETWORK_TIMEOUT,
JOB_CANCELLED, UNSUPPORTED_CONNECTION, UNKNOWN_ERROR
```

Không có `PRINTER_ALREADY_REGISTERED` — `connect()` idempotent (tạo mới hoặc dùng lại theo
`printerId`), không có khái niệm "đăng ký trùng" cần báo lỗi riêng. Không có `QUEUE_FULL` —
`PrinterQueue` không giới hạn kích thước (số lệnh in của 1 cửa hàng nhỏ, không cần giới hạn
nhân tạo ở phiên bản này).

`error/PrinterException.java` **giữ nguyên như hiện tại** — không đổi field/constructor:

```java
public class PrinterException extends Exception {
    private final PrinterErrorCode code;
    // constructor (code, message) / (code, message, cause) — không đổi
    public PrinterErrorCode getCode();
}
```

4 exception con (package `exception/`, `extends error.PrinterException`) chỉ khai báo
constructor pass-through, không thêm field:

```java
/**
 * Lỗi khi mở/đóng kết nối.
 */
public class PrinterConnectionException extends PrinterException { }

/**
 * Lỗi liên quan permission Android (USB).
 */
public class PrinterPermissionException extends PrinterException { }

/**
 * Lỗi khi ghi dữ liệu.
 */
public class PrinterWriteException extends PrinterException { }

/**
 * Vượt quá thời gian chờ (connect/write/socket).
 */
public class PrinterTimeoutException extends PrinterException { }
```

`PrinterErrorResult` (bridge, `module/PrinterErrorResult.java`) giữ nguyên như hiện tại —
map `PrinterException`/`PrinterErrorCode` sang `promise.reject(code.name(), message)`.

---

## 11. Bridge (`PrinterModule.java`)

```java
/**
 * RN bridge duy nhất cho printer — Promise boundary, sinh printerId cho printer mới.
 */
public final class PrinterModule extends ReactContextBaseJavaModule {

    /**
     * Liệt kê thiết bị khả dụng cho 1 loại kết nối.
     *
     * @param type loại kết nối ("usb"/"bluetooth"/"lan")
     * @param promise promise nhận danh sách PrinterInfo
     */
    @ReactMethod
    public void discoverPrinters(String type, Promise promise);

    /**
     * Kết nối tới printer theo thông tin truyền vào.
     *
     * <p>Idempotent theo printerId — gọi lại khi đã CONNECTED không mở thêm
     * kết nối mới.</p>
     *
     * @param printer thông tin kết nối (printerId bắt buộc, type + field theo loại)
     * @param promise promise nhận kết quả kết nối
     */
    @ReactMethod
    public void connect(ReadableMap printer, Promise promise);

    /**
     * Kết nối lại 1 printer đã có trong Registry.
     *
     * @param printerId id printer cần kết nối lại
     * @param promise promise nhận kết quả kết nối
     */
    @ReactMethod
    public void reconnect(String printerId, Promise promise);

    /**
     * Đóng kết nối tới printer.
     *
     * @param printerId id printer cần ngắt kết nối
     * @param promise promise nhận kết quả ngắt kết nối
     */
    @ReactMethod
    public void disconnect(String printerId, Promise promise);

    /**
     * Giải mã Base64 rồi ghi raw bytes tới printer.
     *
     * <p>Kết nối được giữ nguyên sau khi ghi — chỉ đóng khi gọi
     * {@code disconnect()} tường minh.</p>
     *
     * @param printerId id printer đích
     * @param base64Data dữ liệu đã encode Base64
     * @param promise promise nhận kết quả ghi
     */
    @ReactMethod
    public void writeByBase64(String printerId, String base64Data, Promise promise);

    /**
     * Lấy metadata của 1 printer đã đăng ký.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận metadata
     */
    @ReactMethod
    public void getPrinterInfo(String printerId, Promise promise);

    /**
     * Lấy capability native đã detect cho 1 printer.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận capability
     */
    @ReactMethod
    public void getPrinterCapabilities(String printerId, Promise promise);

    /**
     * Lấy trạng thái kết nối sống hiện tại của 1 printer — nguồn sự thật
     * thật sự, để JS xác thực thay vì tự suy luận qua kết quả các lệnh
     * đã gọi trước đó.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận trạng thái hiện tại (tên PrinterState)
     */
    @ReactMethod
    public void getConnectionState(String printerId, Promise promise);

    /**
     * Huỷ 1 job còn đang chờ trong hàng đợi.
     *
     * @param jobId id job cần huỷ
     * @param promise promise nhận kết quả huỷ
     */
    @ReactMethod
    public void cancelPrintJob(String jobId, Promise promise);

    /**
     * Lấy trạng thái hàng đợi hiện tại của 1 printer.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận trạng thái hàng đợi
     */
    @ReactMethod
    public void getQueueStatus(String printerId, Promise promise);
}
```

`connect` — input map (theo `type`), `printerId` luôn do JS truyền vào:

```text
USB:       { printerId: string, type: "usb", vendorId: number, productId: number }
Bluetooth: { printerId: string, type: "bluetooth", address: string }
LAN:       { printerId: string, type: "lan", host: string, port: number }
```

Không có `registerPrinter`/`unregisterPrinter` riêng.

`getName()` tiếp tục trả `"ThermalPrinterModule"` — tên module phía JS không đổi.

---

## 12. Threading & async model

Nội bộ (`PrinterManager` → `IPrinterDevice` → `Connection`/`Writer`): `CompletableFuture`.
Boundary `PrinterModule`: `Promise` — map 1-1 từ `CompletableFuture`
(`.thenAccept(result -> promise.resolve(...))` / `.exceptionally(error -> { ...
PrinterErrorResult...rejectTo(promise); return null; })`).

Mỗi `PrinterQueue` sở hữu 1 `Executors.newSingleThreadExecutor()` riêng — I/O luôn chạy
trên thread đó, không bao giờ trên main thread Android hay JS thread.

`PrinterManager.shutdown()` được `PrinterModule.invalidate()` (React Native New
Architecture lifecycle hook) gọi khi module bị huỷ: đóng tất cả `IPrinterDevice`, gọi
`PrinterQueueManager.shutdownAll()`.

---

## 13. Discovery & Capability Detection

```java
/**
 * Tìm các printer khả dụng cho 1 loại kết nối.
 */
public interface IPrinterDiscovery {

    /**
     * Quét thiết bị khả dụng.
     *
     * @return danh sách printer tìm thấy
     * @throws PrinterException DISCOVERY_FAILED nếu hệ thống USB/Bluetooth không sẵn sàng
     */
    List<PrinterInfo> discover() throws PrinterException;
}
```

`UsbPrinterDiscovery`/`BluetoothPrinterDiscovery` giữ nguyên logic quét thiết bị hiện tại
(`UsbManager.getDeviceList()`/`BluetoothAdapter` bonded devices), chỉ đổi kiểu trả về từ
`IPrinterDevice` sang `PrinterInfo`. Không có discovery cho LAN — network printer nhập IP
thủ công, đúng như app hiện tại.

Discovery **không** connect printer — chỉ trả về `PrinterInfo`, việc mở kết nối là của
`IPrinterDevice.connect()` sau đó.

```java
/**
 * Phát hiện capability quan sát được từ native — không suy đoán, không biết protocol.
 */
public interface ICapabilityDetector {

    /**
     * Phát hiện capability cho 1 printer.
     *
     * @param info metadata printer
     * @return capability đã detect
     */
    PrinterCapabilities detect(PrinterInfo info);
}

/**
 * ICapabilityDetector cho printer USB.
 */
public final class UsbCapabilityDetector implements ICapabilityDetector { }

/**
 * ICapabilityDetector cho printer Bluetooth.
 */
public final class BluetoothCapabilityDetector implements ICapabilityDetector { }

/**
 * ICapabilityDetector cho printer LAN.
 */
public final class NetCapabilityDetector implements ICapabilityDetector { }
```

Chưa có consumer JS nào gọi `getPrinterCapabilities` ở thời điểm viết spec này — cả 3
detector trả `UNKNOWN` cho mọi field ở phiên bản đầu (hạ tầng sẵn sàng, chưa cắm logic đọc
status thật qua lệnh ESC/POS, việc đó thuộc tầng driver JS).

---

## 14. SOLID

- **SRP**: `IPrinterDevice` (vòng đời printer), `Connection` (mở/đóng kênh), `Writer` (ghi
  bytes), `Discovery` (tìm thiết bị), `ICapabilityDetector` (capability), `PrinterQueue`
  (thứ tự job), `PrinterRegistry` (lưu trữ) — mỗi lớp 1 việc.
- **OCP**: thêm 1 loại transport mới (vd Serial) chỉ cần thêm `SerialPrinterDevice` +
  `SerialConnection`/`SerialWriter`, không sửa `PrinterManager`/`PrinterQueue`.
- **LSP**: `UsbPrinterDevice`/`BluetoothPrinterDevice`/`NetPrinterDevice` thay thế được cho
  nhau qua interface `IPrinterDevice`.
- **ISP**: tách `IPrinterConnection`/`IPrinterWriter`/`IPrinterDiscovery`/`ICapabilityDetector`
  thay vì gộp vào 1 interface `PrinterTransport` khổng lồ.
- **DIP**: `PrinterManager` phụ thuộc `IPrinterDevice`/`PrinterRegistry`/`PrinterQueueManager`
  (abstraction), không phụ thuộc `UsbDeviceConnection`/`BluetoothSocket`/`Socket`.

---

## 15. JS-side changes (trong phạm vi plan lần này)

- `PrinterNativeModule.ts`: viết lại theo bridge API mục 11 — địa chỉ hoá theo `printerId`
  thay vì `connectionType`; bỏ `keepConnection` khỏi `PrinterPrintTextOptions` và khỏi
  `printRawDataUsb/Bluetooth/Lan`.
- `IPrinterAdapter.ts`: `PrinterPrintTextOptions` bỏ field `keepConnection`.
- `NativeAdapter.ts`: đổi call site theo API mới, truyền `printerId` (đã có sẵn từ
  `useAddPrinterFlow.ts`/`Printer.id`) vào `connect`/`reconnect`/`disconnect`/`writeByBase64`.
- **Không đổi**: `useAddPrinterFlow.ts` (cách sinh `printerId` giữ nguyên — mục 3),
  `PrintScheduler.ts`, `PrinterConnectionLock.ts`, `resourceKey` — theo đúng quyết định ở
  mục 1.

`getConnectionState` (mục 8, 11) là method MỚI, chưa có consumer bắt buộc trong plan lần
này — `PrinterConnectionService`/`usePrinterConnection.ts` (tầng thống nhất theo dõi status
cho cả native lẫn `LibraryAdapter`, xem `ARCHITECTURE.md`) tiếp tục dùng cơ chế suy luận
hiện tại, không bắt buộc đổi sang query native ngay. Việc dùng `getConnectionState` để xác
thực trạng thái cho riêng nhánh native (thay vì suy luận) là cải tiến để lại cho 1 spec
sau — phạm vi cross-cutting cả `LibraryAdapter`, vượt ngoài native printer layer.

---

## 16. Comment convention (áp dụng khi implement)

Javadoc public API viết theo format ở các code block trên: khối `/** ... */` nhiều dòng,
câu đầu nói đúng chức năng hiện tại (không nhắc version cũ, không so sánh "trước
đây"/"không còn"), có `@param` cho từng tham số và `@return`/`@throws` khi method trả giá
trị có ý nghĩa cần giải thích thêm hoặc ném lỗi cụ thể. Field dùng comment 1 dòng
`/** ... */` ngay trên khai báo. Chỉ viết thêm đoạn `<p>...</p>` khi có 1 ràng buộc hoặc
hành vi thật sự không hiển nhiên nếu chỉ đọc tên method (vd lý do permission USB bất đồng
bộ ở mục 6, lý do không tự động retry ở mục 9).

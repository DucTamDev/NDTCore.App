# NDTCore POS — Native Android Printer Layer v2 (Registry + Queue)

Thay thế toàn bộ kiến trúc native hiện tại (`ThermalPrinterModule` → `PrinterService` →
`IPrinterTransport` theo `ConnectionType`, 1 device active/loại) bằng model hỗ trợ
**nhiều printer cùng loại kết nối song song**, mỗi printer có hàng đợi in riêng.

Base ý tưởng lấy từ doc kiến trúc do user cung cấp (Device/Connection/Writer/Discovery/
Detector/Queue). Spec này là bản đã điều chỉnh sau khi đối chiếu với code JS hiện có —
những chỗ khác với doc gốc đều nêu rõ lý do.

---

## 1. Mục tiêu & ngoài phạm vi

Giữ nguyên như doc gốc: native lo device/connection/write/permission/discovery/
capability/queue/concurrency/timeout/error, **không** biết ESC/POS/TSPL/Base64-business/
rendering — các phần đó thuộc JS (`drivers/EscPosDriver`, `drivers/TsplDriver`).

Native **không** đụng tới `PrintScheduler`/`PrinterConnectionLock`/`resourceKey` hiện có ở
JS (`services/printing/PrintScheduler.ts`) — 2 hệ thống hàng đợi (native theo `printerId`,
JS theo `resourceKey` tính từ driver+connection) tồn tại song song trong đợt này.
Việc có nên gộp/bỏ bớt 1 bên hay không là quyết định của 1 spec sau, sau khi native chạy
ổn định.

---

## 2. Vì sao cần Registry (khác biệt lớn nhất so với code hiện tại)

Code hiện tại: `PrinterService` giữ `Map<ConnectionType, IPrinterTransport>` — đúng 1 USB +
1 Bluetooth + 1 LAN active cùng lúc, không hơn. `connect()` truyền thẳng
`vendorId/productId`/`address`/`host+port` mỗi lần gọi, không có khái niệm nhiều printer
cùng loại.

Yêu cầu mới: nhiều máy in **cùng loại** (vd 2 USB) kết nối song song, in độc lập theo FIFO
riêng. Muốn vậy bridge API phải địa chỉ hoá theo `printerId` thay vì `connectionType`, và
native cần 1 `PrinterRegistry` giữ `Map<printerId, PrinterDevice>`.

**Không có ràng buộc "1 thiết bị vật lý chỉ được 1 transport"** — `identityKey` khác
namespace hoàn toàn giữa USB/Bluetooth/LAN, native không có cách nào biết 2 định danh đó
là cùng 1 máy vật lý, nên không cố dedup xuyên-transport. `PrinterRegistry` chỉ đảm bảo
duy nhất theo `printerId`.

---

## 3. `printerId` — nguồn sinh & vòng đời

Khác doc gốc (doc gốc coi `printerId` là input có sẵn, không nói rõ sinh ở đâu).

**Native là nơi sinh `printerId` cho máy in mới**, JS sinh cho mọi ID khác (job, request) —
đây là ngoại lệ có chủ đích, không phải bất nhất ngẫu nhiên:

```text
Máy in MỚI (chưa lưu, initialValues rỗng trong useAddPrinterFlow):
JS: connect({ printerId: null, type, vendorId, productId, ... })
        │
        ▼
Native: printerId rỗng → generate mới (UUID) → tạo PrinterDevice → put vào Registry
        │
        ▼ connect thành công
Native: resolve({ printerId: "<uuid-mới>" })
        │
        ▼
JS: dùng printerId này cho toàn bộ phần còn lại của flow (testPrint, discovery...),
    lúc bấm "Lưu" → PrinterRepository.addPrinter({ id: printerId, ... })

Máy in ĐÃ LƯU (initialValues.id có sẵn):
JS: connect({ printerId: "<id-đã-lưu>", type, vendorId, productId, ... })
        │
        ▼
Native: printerId có sẵn → Registry.get(id) có thì tái dùng (idempotent),
        không có thì tạo mới NGAY DƯỚI key đó (vd sau khi app restart, Registry rỗng)
```

Quy tắc: **native chỉ generate `printerId` khi field này null/rỗng trong request `connect`**.
Nếu connect thất bại (lỗi permission/device not found/...) thì **không** tạo entry trong
Registry, không trả `printerId` nào — giữ nguyên hành vi lỗi bình thường (`promise.reject`).

Hệ quả cho JS (`useAddPrinterFlow.ts`): `connect()` phải là lệnh native ĐẦU TIÊN trong flow
"Thêm máy in mới" — không còn `useMemo(() => generateId(), ...)` sinh `printerId` trước khi
connect nữa. Với flow "Sửa máy in đã lưu" thì không đổi (đã có `id` từ trước).

`printerId` sinh ở native **không liên quan `identityKey`** (JS tự tính, tự dedup, native
không biết/không cần biết).

---

## 4. Package layout

```text
android/app/src/main/java/com/ndtcorepos/thermalprinter/
├── module/
│   ├── PrinterModule.java            (bridge — thay ThermalPrinterModule)
│   └── PrinterErrorResult.java       (giữ nguyên, Promise.reject có cấu trúc)
├── printer/
│   ├── PrinterManager.java           (facade, thay PrinterService)
│   ├── PrinterRegistry.java          (Map<printerId, PrinterDevice>, thread-safe)
│   ├── PrinterDevice.java            (interface — connect/disconnect/write/getInfo/...)
│   ├── PrinterInfo.java
│   ├── PrinterCapabilities.java
│   ├── CapabilityState.java
│   ├── PrinterState.java
│   └── PrinterResult.java
├── device/
│   ├── UsbPrinterDevice.java
│   ├── BluetoothPrinterDevice.java
│   └── NetPrinterDevice.java
├── transport/
│   ├── PrinterConnection.java        (lifecycle thuần: open/close/isOpen — KHÔNG PHẢI
│   │                                   sealed interface data cũ, xem mục 5)
│   ├── PrinterWriter.java
│   ├── usb/  (UsbConnection, UsbWriter, UsbEndpointResolver — UsbPermission giữ tên cũ)
│   ├── bluetooth/ (BluetoothConnection, BluetoothWriter)
│   └── net/ (NetConnection, NetWriter)
├── queue/
│   ├── PrinterQueueManager.java       (Map<printerId, PrinterQueue>)
│   ├── PrinterQueue.java              (1 single-thread executor/queue → tự FIFO)
│   ├── PrintJob.java
│   └── PrintJobResult.java
├── discovery/
│   ├── IPrinterDiscovery.java         (giữ tên cũ, không đổi thành PrinterDiscovery)
│   ├── usb/UsbPrinterDiscovery.java   (giữ nguyên, đã có isPrintableUsbDevice helper)
│   └── bluetooth/BluetoothPrinterDiscovery.java (giữ nguyên)
├── detector/
│   ├── CapabilityDetector.java
│   ├── UsbCapabilityDetector.java
│   ├── BluetoothCapabilityDetector.java
│   └── NetCapabilityDetector.java
├── enums/ConnectionType.java          (giữ nguyên)
├── exception/
│   ├── PrinterException.java          (giữ getCode())
│   ├── PrinterConnectionException.java
│   ├── PrinterPermissionException.java
│   ├── PrinterWriteException.java
│   └── PrinterTimeoutException.java
├── error/PrinterErrorCode.java        (mở rộng theo mục 9 — giữ chỗ cũ, không dời sang exception/)
└── permission/UsbPermission.java      (giữ nguyên, không đổi)
```

Xoá hoàn toàn: `model/PrinterConnection.java` (sealed interface data cũ), `model/IPrinterDevice.java`
(thay bằng `printer/PrinterDevice.java` — interface mới, khác method signature), `transport/IPrinterTransport.java`,
`application/PrinterService.java`, `application/PrinterServiceFactory.java`, `module/ThermalPrinterModule.java`
(nội dung chuyển sang `module/PrinterModule.java`, đổi tên `getName()` vẫn giữ giá trị
string `"ThermalPrinterModule"` — **không đổi tên module RN, JS `NativeModules.ThermalPrinterModule`
không đổi**, chỉ đổi tên file/class Java).

`UsbPrinterDiscovery`, `BluetoothPrinterDiscovery`, `UsbPermission` giữ nguyên logic hiện
tại — không viết lại, chỉ đổi chỗ nào cần khớp interface `PrinterDevice`/`PrinterConnection` mới.

---

## 5. `PrinterConnection` — đổi nghĩa hoàn toàn so với code hiện tại

Code hiện tại (`model/PrinterConnection.java`): sealed interface **chứa data**
(`Usb(vendorId,productId)`/`Bluetooth(address)`/`Lan(host,port)`), truyền vào `connect()`.

Spec này (theo doc gốc mục 9): `PrinterConnection` là interface **lifecycle thuần**,
không chứa data:

```java
/** Lifecycle của 1 kênh giao tiếp với printer — không ghi dữ liệu. */
public interface PrinterConnection {
    /** Mở kênh giao tiếp. */
    CompletableFuture<PrinterResult> open();
    /** Đóng kênh giao tiếp. */
    CompletableFuture<PrinterResult> close();
    /** Kênh có đang mở không. */
    boolean isOpen();
}
```

Data kết nối (vendorId/productId, address, host/port) chuyển thành field riêng của từng
implementation (`UsbConnection(usbManager, permission, vendorId, productId)`,
`BluetoothConnection(address)`, `NetConnection(host, port)`) — được `PrinterDevice`
tương ứng khởi tạo 1 lần khi `PrinterRegistry` tạo device mới từ `PrinterInfo`.

---

## 6. Bridge API (`PrinterModule.java`)

Đã chốt qua thảo luận — khác doc gốc: gộp `register` vào `connect`, bỏ `unregisterPrinter`,
bỏ `keepConnection`.

```java
@ReactMethod
public void discoverPrinters(String type, Promise promise);

/**
 * Kết nối tới printer theo thông tin truyền vào.
 *
 * <p>`printer.printerId` rỗng/null → tạo printer mới, native tự sinh
 * printerId và trả về trong kết quả. Có sẵn → tái sử dụng/tạo lại đúng
 * key đó (idempotent nếu đã connected).</p>
 */
@ReactMethod
public void connect(ReadableMap printer, Promise promise);

/** Kết nối lại — chỉ hoạt động nếu printerId còn tồn tại trong Registry (cùng vòng đời process). */
@ReactMethod
public void reconnect(String printerId, Promise promise);

@ReactMethod
public void disconnect(String printerId, Promise promise);

/** Không còn tham số keepConnection — write() không bao giờ tự disconnect. */
@ReactMethod
public void writeByBase64(String printerId, String base64Data, Promise promise);

@ReactMethod
public void getPrinterInfo(String printerId, Promise promise);

@ReactMethod
public void getPrinterCapabilities(String printerId, Promise promise);

@ReactMethod
public void cancelPrintJob(String jobId, Promise promise);

@ReactMethod
public void getQueueStatus(String printerId, Promise promise);
```

`connect` map input (theo `type`):

```text
USB:       { printerId?, type: "usb", vendorId, productId }
Bluetooth: { printerId?, type: "bluetooth", address }
LAN:       { printerId?, type: "lan", host, port }
```

`connect` resolve value: `{ printerId: string }` (luôn trả về — giá trị truyền vào nếu có,
giá trị mới sinh nếu không).

Không có `registerPrinter`/`unregisterPrinter` riêng — `connect` gánh luôn phần "khai báo",
`disconnect` là đủ để dọn khi JS xoá 1 printer đã lưu (Registry giữ entry ở trạng thái
`DISCONNECTED`, không tốn tài nguyên đáng kể với số lượng máy in nhỏ của 1 cửa hàng).

---

## 7. `PrinterRegistry` / `PrinterManager`

```java
/** Registry thread-safe các printer đang được native quản lý, khoá theo printerId. */
public final class PrinterRegistry {
    public PrinterDevice get(String printerId);
    public void put(String printerId, PrinterDevice device);
    public void remove(String printerId);
    public List<PrinterDevice> getAll();
}
```

`PrinterManager` (facade, RN gọi qua `PrinterModule`) là nơi biết cách dựng đúng loại
`PrinterDevice` (Usb/Bluetooth/Net) từ `PrinterInfo.connectionType` — `Registry` chỉ lưu
trữ, không tự tạo device:

```java
public final class PrinterManager {
    /**
     * printerId rỗng/null → sinh mới, tạo PrinterDevice theo info.connectionType, put
     * vào registry rồi connect. Có sẵn → registry.get(); null thì tạo lại đúng key đó
     * (vd sau khi app restart) trước khi connect.
     */
    public CompletableFuture<PrinterResult> connect(String printerId, PrinterInfo info);
    public CompletableFuture<PrinterResult> reconnect(String printerId);
    public CompletableFuture<PrinterResult> disconnect(String printerId);
    public PrinterInfo getInfo(String printerId);
    public PrinterCapabilities getCapabilities(String printerId);
    public CompletableFuture<PrintJobResult> write(String printerId, byte[] data);
    public boolean cancelJob(String jobId);
    public QueueStatus getQueueStatus(String printerId);
}
```

Không có method `register`/`unregister` riêng — `connect` gánh cả việc tạo/lưu vào
`Registry` lẫn mở connection thật.

---

## 8. Queue — 1 queue/printerId, không ResourceLock riêng

Khác doc gốc mục 34-36 (`ResourceLock` tách biệt `Queue`): trong hệ thống này, mỗi
`ConnectionType` của Android (`UsbManager`, `BluetoothAdapter`, `Socket`) không có giới
hạn kiểu "1 resource dùng chung cho nhiều device" ở tầng OS — không có tình huống 2
`printerId` khác nhau phải tranh chấp 1 tài nguyên native chung. Vì vậy **bỏ `ResourceLock`
như 1 khái niệm riêng** — FIFO của `PrinterQueue` (theo `printerId`) là đủ.

```java
/** Hàng đợi FIFO cho 1 printer — chạy trên 1 single-thread executor riêng. */
public final class PrinterQueue {
    private final String printerId;
    private final ExecutorService executor; // Executors.newSingleThreadExecutor()

    public CompletableFuture<PrintJobResult> enqueue(PrintJob job);
    public boolean cancel(String jobId); // chỉ huỷ được job còn PENDING
    public QueueStatus status();
    public void shutdown();
}
```

`PrinterQueueManager` giữ `Map<printerId, PrinterQueue>`, tạo lười khi có job đầu tiên cho
1 printerId. Job FAILED không chặn job sau (executor tiếp tục lấy job tiếp theo trong
queue của nó — hành vi mặc định của `ExecutorService` khi task ném exception được bắt gọn
trong `write()`, không để lọt ra ngoài làm executor chết).

Retry: theo doc gốc mục 31 — thuộc về job, thực hiện tuần tự trước khi trả kết quả cuối
(không cho job khác trong cùng queue vượt lên). `maxAttempts` mặc định 1 (không tự retry)
trừ khi caller yêu cầu khác — native **không tự ý retry write thất bại vì rủi ro in trùng
(duplicate print)** đã nêu ở doc gốc mục 60; retry chỉ chạy khi JS chủ động gọi lại.

---

## 9. Error model

Giữ `PrinterErrorCode` hiện có (`error/PrinterErrorCode.java`), bổ sung theo doc gốc mục 47:

```text
NONE, INVALID_ARGUMENT, PRINTER_NOT_FOUND, PRINTER_CLOSED, PRINTER_BUSY,
PERMISSION_DENIED, PERMISSION_REQUIRED, CONNECTION_FAILED, CONNECTION_TIMEOUT,
NOT_CONNECTED, WRITE_FAILED, WRITE_TIMEOUT, USB_DEVICE_NOT_FOUND,
USB_ENDPOINT_NOT_FOUND, USB_INTERFACE_CLAIM_FAILED, BLUETOOTH_DEVICE_NOT_FOUND,
BLUETOOTH_CONNECTION_FAILED, NETWORK_CONNECTION_FAILED, NETWORK_TIMEOUT,
QUEUE_FULL, JOB_CANCELLED, OPERATION_CANCELLED, UNSUPPORTED, UNKNOWN_ERROR
```

Bỏ `PRINTER_ALREADY_REGISTERED` (doc gốc mục 47/56) — vì `connect` giờ idempotent
(getOrCreate), không có khái niệm "đăng ký trùng" cần báo lỗi riêng.

Exception hierarchy theo doc gốc mục 48 (`PrinterException` + 4 subclass) — mỗi exception
giữ `errorCode`, `message`, `printerId` (bỏ `operationId`/tracing, chưa cần).

`PrinterErrorResult` (bridge, `module/PrinterErrorResult.java`) giữ nguyên như hiện tại.

---

## 10. Threading & async model

Nội bộ (`PrinterManager` → `PrinterDevice` → `Connection`/`Writer`): `CompletableFuture`,
đúng doc gốc mục 42-43. Boundary `PrinterModule`: `Promise` — map 1-1 từ
`CompletableFuture` (`.thenAccept(promise::resolve)` / `.exceptionally(...)`).

Mỗi `PrinterQueue` sở hữu 1 `Executors.newSingleThreadExecutor()` riêng — I/O chạy trên
thread đó, không bao giờ chạy trên main thread/JS thread (đúng doc gốc mục 42).

`PrinterManager.shutdown()` gọi từ `PrinterModule.invalidate()` (React Native New
Architecture — thay `onCatalystInstanceDestroy()` cũ đã deprecated): disconnect tất cả
device, shutdown tất cả executor.

---

## 11. Capability Detection & Discovery

Giữ nguyên tinh thần doc gốc mục 21-26, 65-67: `CapabilityDetector` tách biệt hoàn toàn
`Discovery`, không đoán capability, `UNKNOWN` khi không xác định được. Vì hiện chưa có
consumer JS nào gọi `getPrinterCapabilities`, các detector cụ thể
(`UsbCapabilityDetector`/`BluetoothCapabilityDetector`/`NetCapabilityDetector`) trả cứng
`UNKNOWN` cho mọi field ở phiên bản đầu — hạ tầng đã sẵn sàng, chưa cắm logic đọc thật
(paper sensor/cover sensor qua ESC/POS status command là việc của tầng driver JS, không
phải native).

`IPrinterDiscovery` giữ tên/interface hiện tại (`discover(): List<IPrinterDevice>` —
đổi kiểu trả về `IPrinterDevice` → `PrinterInfo` cho khớp model mới), implementation USB/BT
giữ nguyên logic quét thiết bị.

---

## 12. State machine

Theo đúng doc gốc mục 38-41, 54-55: `REGISTERED → CONNECTING → CONNECTED → DISCONNECTING →
DISCONNECTED`, nhánh lỗi `→ ERROR`. `connect()`/`disconnect()` đều idempotent. Không auto
reconnect trong `write()` — nếu `NOT_CONNECTED` thì trả lỗi, JS tự quyết định gọi lại
`connect()`/`reconnect()`.

---

## 13. JS-side changes (trong phạm vi plan lần này)

- `PrinterNativeModule.ts`: viết lại toàn bộ theo bridge API mục 6 (địa chỉ hoá theo
  `printerId`, bỏ `keepConnection` khỏi `PrinterPrintTextOptions`/`printRawDataUsb/Bluetooth/Lan`).
- `IPrinterAdapter.ts`: `PrinterPrintTextOptions` bỏ field `keepConnection`.
- `NativeAdapter.ts`: đổi call site theo API mới, tự gọi `disconnect()` tường minh ở nơi
  trước đây dựa vào `keepConnection=false` (hiện tại: không có nơi nào set `false`, nên
  không có logic disconnect-sau-write nào cần thêm mới — chỉ xoá field/param thừa).
- `useAddPrinterFlow.ts`: bỏ `useMemo(() => generateId(), ...)` sinh `printerId` trước khi
  connect; đổi thành lấy `printerId` từ response của lệnh `connect()` đầu tiên khi thêm máy
  in mới (giữ nguyên `initialValues?.id` khi sửa máy in đã lưu).
- **Không đổi**: `PrintScheduler.ts`, `PrinterConnectionLock.ts`, `resourceKey` — theo đúng
  quyết định ở mục 1.

---

## 14. SOLID / lý do tách lớp

Giữ nguyên lập luận doc gốc mục 74 (SRP mỗi lớp 1 trách nhiệm, OCP thêm transport không
sửa `PrinterManager`, LSP 3 implementation `PrinterDevice` thay thế được nhau, ISP tách
`PrinterConnection`/`PrinterWriter`/`PrinterDiscovery`/`CapabilityDetector` thay vì 1
interface khổng lồ, DIP `PrinterManager` phụ thuộc abstraction không phụ thuộc
`UsbDeviceConnection`/`BluetoothSocket`/`Socket`).

---

## 15. Comment convention (áp dụng khi implement)

Javadoc public API: 1 dòng, nói chức năng làm gì — đúng style doc gốc
(`/** Opens the underlying communication channel. */`). Không viết đoạn giải thích WHY
nhiều dòng trừ khi có 1 ràng buộc/hành vi thật sự không hiển nhiên (vd lý do
`writeByBase64` không tự disconnect, lý do bỏ `ResourceLock`) — những trường hợp đó ghi
chú ngắn gọn, không quá 2-3 dòng.

# Tầng native thiết bị (`com.ndtcorepos`) — Design Spec

## 1. Mục tiêu

Thiết kế mới tầng native Android (Java) của app, thay toàn bộ `com.ndtcorepos.thermalprinter`.

Tầng native chỉ làm "đường ống" tới thiết bị ngoại vi: **tìm thiết bị, xin quyền, kết nối, ghi/đọc byte, báo mất kết
nối**. Native chỉ nhận **địa chỉ thiết bị** và trả về `connectionId`; không biết `printerId`, máy in đã lưu, giao thức
(ESC/POS, TSPL), khổ giấy hay loại bản in — những thứ đó thuộc tầng TS.

## 2. Nguyên tắc

1. **Native chỉ nhận địa chỉ.** `connectionId` suy ra từ địa chỉ TS truyền vào; cùng địa chỉ luôn ra cùng
   `connectionId`.
2. **Một kết nối vật lý = một `Connection`.** Native không biết hai địa chỉ (USB và LAN) có phải cùng một máy hay
   không; "một máy in nhiều đường kết nối" là việc của TS.
3. **Native bảo đảm thứ tự từng thao tác; TS bảo đảm trọn vẹn từng lệnh in.** Trên một kết nối, `write`/`read`/
   `disconnect` chạy đúng thứ tự gọi, không bao giờ chồng nhau. Nhưng một lệnh in gồm nhiều lần gọi (dò → đọc → ghi
   nội dung), nên **TS phải khoá theo kết nối** để mỗi kết nối chỉ chạy một lệnh in tại một thời điểm (`PrintScheduler`
   + `PrinterConnectionLock` đang làm việc này).
4. **Dùng chung kết nối do TS quản lý.** Hai máy in đã lưu cùng một địa chỉ thì TS đếm số người dùng và chỉ gọi
   `disconnect` khi không còn ai. Native: `connect` lại cùng địa chỉ trả về kết nối đang mở; `disconnect` đóng ngay
   (sau khi các thao tác đã xếp trước chạy xong).
5. **Không chặn luồng của native module.** Việc chậm (xin quyền, mở socket, ghi, đọc, đóng) chạy trên luồng riêng;
   Promise được resolve/reject từ luồng đó.
6. **Native không hiển thị UI** (không `Toast`); thông báo cho người dùng do TS hiển thị bằng tiếng Việt.

## 3. Ngoài phạm vi

- Tái cấu trúc tầng TS máy in (gộp `adapters/` + `transports/`, bỏ `LibraryAdapter`, chuyển TSPL Bluetooth/LAN sang
  native, đổi tên `PrinterDevice`…). Đợt này TS chỉ sửa đủ để chạy với API mới (§11). Ghi lại cho spec TS:
  - Đổi khoá của `PrintScheduler`/`PrinterConnectionLock` sang `connectionId` (hiện USB khoá chung `'usb'`, ESC/POS
    khoá theo loại kết nối) để hai máy khác nhau in song song.
  - Mỗi lệnh in bắt đầu bằng lệnh khởi tạo máy in (`ESC @` cho ESC/POS, `CLS` cho TSPL) để xoá dữ liệu dở nếu lệnh
    trước bị cắt giữa chừng.
- Quét máy in LAN; lọc thiết bị Bluetooth theo loại (trả mọi thiết bị đã ghép đôi).
- iOS.
- Tính năng native khác (màn hình phụ, máy thanh toán…): cấu trúc §5 đã chừa chỗ, chưa làm.

## 4. Hành vi phải đúng (lỗi đang có ở code hiện tại)

| # | Hiện tại | Phải đúng |
|---|---|---|
| 1 | Kết nối USB chỉ tìm theo vendorId/productId → 2 máy cùng model luôn lấy máy đầu | Khớp serial (§9.3) |
| 2 | Rút 1 máy USB, máy cùng model cũng bị coi là mất | Khớp theo đường dẫn thiết bị (`hardwareAddress`) |
| 3 | Rút USB được xử lý ở 2 nơi không phối hợp | Một đường duy nhất: monitor → `ConnectionPool` |
| 4 | Ghi chặn luồng native module tới 15s; kết nối chặn tới 30s khi chờ hộp thoại quyền USB | Chạy trên luồng riêng |
| 5 | USB ghi cả payload 1 lần; ghi thiếu byte vẫn báo thành công | Chia khúc, ghi đủ mới thành công |
| 6 | Timeout ghi Bluetooth/LAN bị bỏ qua; 2 mức timeout chồng nhau | Một hạn do TS truyền |
| 7 | Native không đọc được phản hồi | Có `read` |
| 8 | Receiver nhận cả broadcast từ app khác | Receiver chỉ nhận trong app |
| 9 | `Toast` tiếng Anh từ native | Bỏ |
| 10 | Kết quả "ghi" dùng cho cả mở/đóng kết nối | Lỗi là `DeviceException`, thành công không trả gì |

## 5. Cấu trúc

```text
android/app/src/main/java/com/ndtcorepos/
├── MainActivity.kt
├── MainApplication.kt
│
├── bridge/
│   ├── NdtCorePosPackage.java
│   └── device/
│       ├── DeviceModule.java
│       └── DeviceMapper.java
│
├── common/
│   └── CodedException.java
│
└── device/
    ├── DeviceFactory.java
    ├── DeviceService.java
    ├── model/
    │   ├── DeviceType.java
    │   ├── DeviceAddress.java
    │   ├── DeviceInfo.java
    │   └── DisconnectReason.java
    ├── error/
    │   ├── DeviceException.java
    │   └── DeviceErrorCode.java
    ├── discovery/
    │   ├── IDeviceDiscovery.java
    │   ├── UsbDiscovery.java
    │   └── BluetoothDiscovery.java
    ├── permission/
    │   └── UsbPermission.java
    ├── connection/
    │   ├── IDisconnectListener.java
    │   ├── ConnectionPool.java
    │   └── Connection.java
    ├── transport/
    │   ├── ITransport.java
    │   ├── ITransportFactory.java
    │   ├── TransportFactory.java
    │   ├── UsbTransport.java
    │   ├── BluetoothTransport.java
    │   └── LanTransport.java
    └── monitor/
        ├── IDisconnectMonitor.java
        ├── UsbDetachMonitor.java
        └── BluetoothDisconnectMonitor.java
```

26 file Java. Xoá toàn bộ `com/ndtcorepos/thermalprinter/`.

**Hướng gọi** (một chiều, không vòng):

```text
JS ─► DeviceModule ─► DeviceFactory.create ─► DeviceService ─┬─► discovery/
                                                             └─► ConnectionPool ─► Connection ─► ITransport
                                                                      ▲                              ▲
                                                                  monitor/          TransportFactory ┘
                                                                                          │
                                                                              discovery/, permission/
ConnectionPool ─► IDisconnectListener (DeviceModule cài đặt) ─► sự kiện JS
```

**Quy tắc cấu trúc:**

1. Chỉ `bridge/` import `com.facebook.react.*`.
2. `bridge/` chỉ dùng `DeviceFactory`, `DeviceService`, `model/`, `error/`, `connection/IDisconnectListener`.
3. Các folder trong `device/` gọi theo đúng hướng trên, không gọi ngược.
4. `common/`, `model/`, `error/`, `connection/`, `DeviceService` không dùng API Android → test bằng JUnit thuần.
5. `DeviceFactory` là nơi duy nhất `new` các phần của device; class khác nhận dependency qua constructor.
6. Interface tiền tố `I` (`docs/CODING_STANDARDS.md` Rule 8.3); chỉ tách interface khi có ≥ 2 cài đặt hoặc cần bản
   giả để test.
7. Tính năng native sau này theo cùng khuôn: `bridge/<tinhnang>/<TinhNang>Module` + `<tinhnang>/` có
   `<TinhNang>Factory`, `<TinhNang>Service` và các folder theo việc; cùng đăng ký trong `NdtCorePosPackage`.

## 6. Nhiệm vụ từng folder

| Folder | Lo việc gì | Không làm |
|---|---|---|
| `bridge/` | Nói chuyện với JS: nhận lời gọi, đổi dữ liệu, trả Promise, phát sự kiện | Logic thiết bị, kết nối |
| `common/` | Thứ dùng chung mọi tính năng native (hiện chỉ lỗi có mã) | Bất cứ thứ gì chỉ một tính năng dùng |
| `device/` (gốc) | Lắp ráp (`DeviceFactory`) và cửa vào duy nhất (`DeviceService`) | Gọi Android API trực tiếp |
| `device/model/` | Dữ liệu bất biến: loại, địa chỉ, thông tin thiết bị, lý do mất kết nối | Logic, gọi Android |
| `device/error/` | Mã lỗi và exception của device | — |
| `device/discovery/` | Tìm thiết bị: liệt kê và tìm đúng thiết bị cho một địa chỉ | Mở kết nối, truyền byte |
| `device/permission/` | Xin quyền USB và chờ người dùng trả lời | Quyền Bluetooth (TS xin) |
| `device/connection/` | Giữ kết nối đang mở; xếp hàng thao tác; mở/dùng lại/đóng; xử lý mất kết nối và chen ngang | Biết USB/Bluetooth/LAN cụ thể; gọi Android |
| `device/transport/` | Truyền byte trên từng loại đường truyền: mở, ghi, đọc, đóng | Xếp hàng, dùng chung, phát sự kiện |
| `device/monitor/` | Nghe broadcast của Android khi thiết bị bị rút / mất kết nối | Đóng kết nối (chỉ báo cho `ConnectionPool`) |

## 7. Nhiệm vụ từng file

### 7.1 Khung app

**`MainActivity.kt`** — khung React Native có sẵn. Giữ nguyên.

**`MainApplication.kt`** — đăng ký package native: `add(NdtCorePosPackage())`. Không chứa logic.

### 7.2 `bridge/`

#### `NdtCorePosPackage`

- **Nhiệm vụ:** đăng ký mọi native module của app với React Native.
- **Hàm:** `createNativeModules(ReactApplicationContext)` → `[new DeviceModule(reactContext)]`;
  `createViewManagers` → rỗng.
- **Không làm:** tạo dependency của module (module tự gọi factory của tính năng).

#### `device/DeviceModule`

- **Nhiệm vụ:** các hàm JS gọi tới device; đổi tham số bằng `DeviceMapper`, gọi `DeviceService`, trả Promise; phát sự
  kiện `DeviceDisconnected`.
- **Cài đặt:** `IDisconnectListener`.
- **Field:** `deviceService` (tạo trong constructor: `DeviceFactory.create(reactContext, this)`).
- **Hàm JS** (`@ReactMethod`, tên module JS `DeviceModule`):

  | Hàm | Gọi xuống |
  |---|---|
  | `discover(String type, Promise)` | `deviceService.discover(mapper.toDeviceType(type))` |
  | `connect(ReadableMap address, Promise)` | `deviceService.connect(mapper.toAddress(address))` |
  | `write(String connectionId, String base64Data, double timeoutMs, Promise)` | `deviceService.write(…)` |
  | `read(String connectionId, double maxBytes, double timeoutMs, Promise)` | `deviceService.read(…)` |
  | `disconnect(String connectionId, Promise)` | `deviceService.disconnect(connectionId)` |

- **`invalidate()`** (React Native gọi khi reload/huỷ module): `deviceService.close()`.
- **`onDisconnected(connectionId, reason)`:** phát `DeviceDisconnected { connectionId, reason }`; bỏ qua nếu React
  không còn chạy.
- **Quy tắc:**
  - Không bao giờ đứng chờ: gắn callback vào `CompletableFuture`. Thành công → resolve; `CodedException` → reject bằng
    `code()` + message (lỗi ghi thêm `userInfo.bytesWritten`); exception khác → reject `INTERNAL_ERROR` và log.
  - Số từ JS là `double` → đổi sang `long`/`int`; ≤ 0 → `INVALID_ARGUMENT`.
- **Không làm:** quyết định kết nối, xếp hàng, đọc/ghi thiết bị.

#### `device/DeviceMapper`

- **Nhiệm vụ:** đổi dữ liệu giữa kiểu React Native và kiểu `device/model`.
- **Hàm:**
  - `DeviceType toDeviceType(String wireValue)` — sai → `INVALID_ARGUMENT`.
  - `DeviceAddress toAddress(ReadableMap map)` — đọc `type` rồi các trường theo loại; thiếu/sai kiểu →
    `INVALID_ARGUMENT`.
  - `WritableArray toWritableArray(List<DeviceInfo> devices)` — USB và Bluetooth ra đúng dạng TS (§8).
  - `byte[] toBytes(String base64Data)` — base64 sai → `INVALID_ARGUMENT`.
  - `String toBase64OrNull(byte[] data)` — mảng rỗng → `null`.
  - `WritableMap toDisconnectedEvent(String connectionId, DisconnectReason reason)`.
- **Không làm:** gọi `DeviceService`.

### 7.3 `common/`

#### `CodedException`

- **Nhiệm vụ:** lớp cha trừu tượng của mọi lỗi có mã (`abstract String code()`), để `bridge/` reject Promise bằng mã
  mà không cần biết lỗi từ tính năng nào.
- **Không làm:** chứa mã lỗi cụ thể (mỗi tính năng tự có enum mã).

### 7.4 `device/` gốc

#### `DeviceFactory`

- **Nhiệm vụ:** nơi lắp ráp duy nhất của device — tạo mọi phần và nối chúng lại.
- **Hàm:** `static DeviceService create(Context context, IDisconnectListener listener)`:
  1. Lấy `UsbManager`, tạo `UsbPermission`, `UsbDiscovery`, `BluetoothDiscovery`.
  2. Tạo `TransportFactory(usbManager, usbDiscovery, bluetoothDiscovery)`.
  3. Tạo executor: luồng quét (1), luồng mở kết nối (nhiều), luồng đóng khẩn (1), và cách tạo luồng riêng cho mỗi
     `Connection`.
  4. Tạo `ConnectionPool(…)`, `UsbDetachMonitor`, `BluetoothDisconnectMonitor`.
  5. Tạo `DeviceService(…)`, gọi `start()`, trả về.
- **Không làm:** logic nghiệp vụ.

#### `DeviceService`

- **Nhiệm vụ:** cửa vào duy nhất của device cho `bridge/`; điều phối discovery và `ConnectionPool`.
- **Constructor:** `DeviceService(Map<DeviceType, IDeviceDiscovery> discoveries, ConnectionPool connectionPool,
  List<IDisconnectMonitor> monitors, ExecutorService discoveryExecutor)` (mỗi tham số 1 dòng trong code).
- **Hàm:**

  | Hàm | Làm gì |
  |---|---|
  | `start()` | Bật mọi monitor |
  | `CompletableFuture<List<DeviceInfo>> discover(DeviceType type)` | Chọn discovery theo loại, chạy trên luồng quét; không có (LAN) → `INVALID_ARGUMENT` |
  | `CompletableFuture<String> connect(DeviceAddress address)` | `connectionPool.connect(address)` |
  | `CompletableFuture<Void> write(String connectionId, byte[] data, long timeoutMillis)` | `connectionPool.write(…)` |
  | `CompletableFuture<byte[]> read(String connectionId, int maxBytes, long timeoutMillis)` | `connectionPool.read(…)` |
  | `CompletableFuture<Void> disconnect(String connectionId)` | `connectionPool.disconnect(connectionId)` |
  | `close()` | Tắt monitor, `connectionPool.closeAll()`, tắt luồng quét |

- **Không làm:** gọi Android API; tự tạo dependency.

### 7.5 `device/model/`

Tất cả bất biến (field `final`, không setter), không gọi Android.

#### `DeviceType`

- **Nội dung:** enum `USB`, `BLUETOOTH`, `LAN`; `wireValue()` = `"usb"`, `"bluetooth"`, `"lan"`;
  `static DeviceType fromWireValue(String)`.

#### `DeviceAddress`

- **Nhiệm vụ:** cách tới một thiết bị + `connectionId` của nó.
- **Tạo bằng:** `usb(int vendorId, int productId, String serialNumber)`, `bluetooth(String mac)`,
  `lan(String host, int port)` — kiểm tra tham số ngay (§9.1), sai → `DeviceException(INVALID_ARGUMENT)`.
- **Field:** `type`, `vendorId`, `productId`, `serialNumber` (USB; serial rỗng → `null`), `mac` (Bluetooth), `host`,
  `port` (LAN). Field không thuộc loại để `null`/0.
- **Hàm:** `String connectionId()` (§9.1).

#### `DeviceInfo`

- **Nhiệm vụ:** một thiết bị tìm thấy khi quét.
- **Field:** `type`, `connectionId`, `name`; USB thêm `vendorId`, `productId`, `serialNumber` (`null` khi chưa có
  quyền), `manufacturerName`, `productName`, `hasPermission`; Bluetooth thêm `mac`.
- **Tạo bằng:** `usb(…)`, `bluetooth(…)`.

#### `DisconnectReason`

- **Nội dung:** enum `USB_DETACHED`, `BLUETOOTH_DISCONNECTED`, `IO_ERROR`; `wireValue()` = `"usb_detached"`,
  `"bluetooth_disconnected"`, `"io_error"`.

### 7.6 `device/error/`

#### `DeviceErrorCode`

- **Nội dung:** enum 12 mã (§10).

#### `DeviceException`

- **Nhiệm vụ:** lỗi của device; kế thừa `CodedException`.
- **Field:** `errorCode` (`DeviceErrorCode`), `bytesWritten` (mặc định 0; có nghĩa với `WRITE_*` và
  `CONNECTION_LOST` khi đang ghi).
- **Hàm:** `code()` → `errorCode.name()`; `DeviceException withBytesWritten(int)`.

### 7.7 `device/discovery/`

#### `IDeviceDiscovery`

- **Nhiệm vụ:** việc chung của mọi cách quét.
- **Hàm:** `List<DeviceInfo> discover() throws DeviceException`.
- **Cài đặt:** `UsbDiscovery`, `BluetoothDiscovery`.

#### `UsbDiscovery`

- **Nhiệm vụ:** liệt kê thiết bị USB đang cắm có thể nhận dữ liệu in; tìm đúng thiết bị cho một địa chỉ USB.
- **Dependency:** `UsbManager`, `UsbPermission`.
- **Hàm:**
  - `discover()` — thiết bị có interface chứa endpoint bulk OUT; đọc serial nếu đã có quyền (không có → `null`); tên =
    `productName`, không có thì `deviceName`. **Không** mở hộp thoại quyền.
  - `UsbDevice find(DeviceAddress address) throws DeviceException` — luật §9.3; có thể xin quyền nên chỉ gọi từ luồng
    mở kết nối.
  - `static <T> T chooseCandidate(List<T> candidates, String targetSerial, ISerialReader<T> serialReader)` — luật
    chọn thuần, để test JUnit. `ISerialReader` là interface lồng trong `UsbDiscovery`
    (`String readSerial(T candidate) throws DeviceException`).
- **Không làm:** mở kết nối USB.

#### `BluetoothDiscovery`

- **Nhiệm vụ:** liệt kê thiết bị Bluetooth đã ghép đôi; tìm theo MAC.
- **Dependency:** `Context` (lấy `BluetoothManager`).
- **Hàm:**
  - `discover()` — mọi thiết bị đã ghép đôi.
  - `BluetoothDevice findBonded(String mac) throws DeviceException` — không có → `DEVICE_NOT_FOUND`.
- **Lỗi:** máy không có Bluetooth hoặc đang tắt → `BLUETOOTH_DISABLED`; `SecurityException` → `PERMISSION_DENIED`.
- **Không làm:** xin quyền Bluetooth; quét thiết bị chưa ghép đôi.

### 7.8 `device/permission/`

#### `UsbPermission`

- **Nhiệm vụ:** hỏi người dùng cho phép app dùng một thiết bị USB và chờ câu trả lời.
- **Dependency:** `Context`, `UsbManager`.
- **Hàm:**
  - `boolean hasPermission(UsbDevice device)`.
  - `void request(UsbDevice device) throws DeviceException` — chặn luồng gọi, chỉ gọi từ luồng mở kết nối.
- **Quy tắc:**
  - Đã có quyền → trả ngay.
  - Mỗi lần xin: đăng ký receiver tạm (`RECEIVER_NOT_EXPORTED`) nhận kết quả quyền **và** sự kiện rút đúng thiết bị
    đó (so `deviceName`); `PendingIntent` gắn package của app; xong thì huỷ receiver.
  - Chờ tối đa `PERMISSION_TIMEOUT_MS` = 30 000; từ chối / hết giờ / rút dây khi hộp thoại đang mở →
    `PERMISSION_DENIED`.
- **Không làm:** quyền Bluetooth/Location (TS xin qua `PrinterPermissionService`).

### 7.9 `device/connection/`

Không dùng API Android.

#### `IDisconnectListener`

- **Nhiệm vụ:** cách `ConnectionPool` báo ra ngoài khi một kết nối mất ngoài ý muốn.
- **Hàm:** `void onDisconnected(String connectionId, DisconnectReason reason)`.
- **Cài đặt:** `DeviceModule`.

#### `ConnectionPool`

- **Nhiệm vụ:** giữ các kết nối theo `connectionId`; mở, dùng lại, đóng; xử lý mất kết nối và các tình huống chen
  ngang (§9.4).
- **Constructor** (mỗi tham số 1 dòng): `ITransportFactory transportFactory`, `IDisconnectListener listener`,
  `ExecutorService connectExecutor`, `ExecutorService abortExecutor`,
  `Supplier<ExecutorService> operationExecutorFactory`.
- **Trạng thái:**
  - `openConnections`: `connectionId → Connection` đang mở.
  - `openingConnections`: `connectionId → future` đang mở dở.
  - `closingConnections`: `connectionId → future` đang đóng do `disconnect`.
  - `closed`: đã `closeAll()`.
- **Hàm:**

  | Hàm | Làm gì |
  |---|---|
  | `CompletableFuture<String> connect(DeviceAddress address)` | Theo §9.4; mở bằng `transportFactory.create(address)` + `transport.open()` trên luồng mở kết nối, tạo `Connection` |
  | `CompletableFuture<Void> write(String connectionId, byte[] data, long timeoutMillis)` | Không có kết nối đang mở → `NOT_CONNECTED`; có → `connection.write` |
  | `CompletableFuture<byte[]> read(String connectionId, int maxBytes, long timeoutMillis)` | Như `write` |
  | `CompletableFuture<Void> disconnect(String connectionId)` | Theo §9.4 |
  | `void onHardwareLost(String hardwareAddress, DisconnectReason reason)` | Monitor gọi; tìm kết nối đang mở có `hardwareAddress` trùng → `loseConnection` |
  | `void closeAll()` | Theo §9.4 |

- **Hàm riêng:** `loseConnection(connectionId, reason)` — dùng chung cho monitor và lỗi I/O: bỏ khỏi
  `openConnections` (không có → bỏ qua), báo `listener`, rồi `connection.abort()` trên luồng đóng khẩn.
- **Không làm:** biết USB/Bluetooth/LAN cụ thể.

#### `Connection`

- **Nhiệm vụ:** một kết nối đang mở; chạy mọi thao tác lần lượt trên một luồng riêng; quyết định mã lỗi khi bị cắt
  ngang.
- **Constructor:** `String connectionId`, `ITransport transport`, `ExecutorService operationExecutor`,
  `Runnable transportLostHandler`.
- **Trạng thái:** `OPEN` → `CLOSING` (đã xếp `close`) → `CLOSED`; hoặc `OPEN`/`CLOSING` → `ABORTED`.
- **Hàm:**

  | Hàm | Làm gì |
  |---|---|
  | `CompletableFuture<Void> write(byte[] data, long timeoutMillis)` | Xếp hàng; tới lượt: hạn = bây giờ + timeout → `transport.write(data, deadline)` |
  | `CompletableFuture<byte[]> read(int maxBytes, long timeoutMillis)` | Như `write` với `transport.read` |
  | `CompletableFuture<Void> close()` | Xếp sau các thao tác trước; tới lượt: `transport.close()`, tắt luồng |
  | `void abort()` | Không chờ: `ABORTED`, `transport.close()` ngay (giải phóng luồng đang kẹt), hoàn tất mọi thao tác chưa xong với `CONNECTION_LOST`, tắt luồng |
  | `String hardwareAddress()` | `transport.hardwareAddress()` |
  | `boolean isAlive()` | `OPEN` và `transport.isOpen()` |

- **Quy tắc lỗi:**
  - Đã `ABORTED` → mọi thao tác (đang chạy hoặc đang chờ) kết thúc với `CONNECTION_LOST`, giữ `bytesWritten`.
  - Thao tác lỗi (kể cả hết hạn) mà sau đó `transport.isOpen() == false` → gọi `transportLostHandler`
    (`ConnectionPool` xử lý như mất kết nối `IO_ERROR`); thao tác đó vẫn trả mã lỗi gốc.
  - Hết hạn mà transport vẫn mở (USB) → giữ kết nối, chỉ trả `WRITE_TIMEOUT`.
  - Thao tác mới sau `close()`/`abort()` → `NOT_CONNECTED`.
- **Không làm:** biết pool, sự kiện JS.

### 7.10 `device/transport/`

#### `ITransport`

- **Nhiệm vụ:** truyền byte trên một đường truyền.
- **Hàm:**

  | Hàm | Hợp đồng |
  |---|---|
  | `void open() throws DeviceException` | Lỗi → `CONNECTION_FAILED` (hoặc mã cụ thể hơn) |
  | `void write(byte[] data, long deadlineMillis) throws DeviceException` | Ghi đủ toàn bộ hoặc ném `WRITE_TIMEOUT`/`WRITE_FAILED` kèm số byte đã ghi |
  | `byte[] read(int maxBytes, long deadlineMillis) throws DeviceException` | Trả byte đọc được; hết hạn không có byte → mảng rỗng; lỗi → `READ_FAILED` |
  | `void close()` | Không ném lỗi; gọi nhiều lần không sao; gọi được từ luồng khác trong lúc đang ghi/đọc (dùng để cắt ngang) |
  | `boolean isOpen()` | Phản ánh đúng việc còn dùng được không, kể cả sau lỗi |
  | `String hardwareAddress()` | Địa chỉ phần cứng để monitor khớp |

- `deadlineMillis` là mốc thời gian tuyệt đối để một lần ghi nhiều khúc không cộng dồn timeout.

#### `ITransportFactory`

- **Hàm:** `ITransport create(DeviceAddress address) throws DeviceException` — được phép chặn (tìm thiết bị, xin
  quyền USB); chỉ gọi từ luồng mở kết nối.
- **Cài đặt:** `TransportFactory`; test dùng bản giả.

#### `TransportFactory`

- **Nhiệm vụ:** tạo đúng transport cho một địa chỉ.
- **Dependency:** `UsbManager`, `UsbDiscovery`, `BluetoothDiscovery`.
- **Hàm:** `create(address)` chỉ điều phối theo `DeviceType`, mỗi loại 1 hàm riêng:
  - `createUsb` → `usbDiscovery.find(address)` → `new UsbTransport(usbManager, device)`.
  - `createBluetooth` → `bluetoothDiscovery.findBonded(address.mac())` → `new BluetoothTransport(device)`.
  - `createLan` → `new LanTransport(address.host(), address.port())`.
- **Không làm:** mở transport (việc của `ConnectionPool`).

#### `UsbTransport`

- **Nhiệm vụ:** truyền byte qua USB.
- **`open`:** `openDevice` + `claimInterface(force = true)` trên interface có bulk OUT; giữ bulk IN nếu có; lỗi →
  `CONNECTION_FAILED`.
- **`write`:** chia khúc tối đa `USB_CHUNK_SIZE_BYTES` = 16 384, `bulkTransfer(endpoint, buffer, offset, length,
  timeout)` với timeout = thời gian còn lại; lặp tới đủ; trả < 0 → `WRITE_TIMEOUT` nếu đã hết hạn, ngược lại
  `WRITE_FAILED`. Vòng chia khúc là hàm static nhận một "người ghi khúc" để test JUnit.
- **`read`:** không có bulk IN → `READ_NOT_SUPPORTED`; có → `bulkTransfer` IN với thời gian còn lại.
- **`isOpen`:** đã claim và thiết bị còn trong `usbManager.getDeviceList()`.
- **`close`:** `releaseInterface` + `close`.
- **`hardwareAddress`:** `UsbDevice.getDeviceName()` (vd `/dev/bus/usb/001/004`; khác nhau giữa 2 máy cùng model).

#### `BluetoothTransport`

- **Nhiệm vụ:** truyền byte qua Bluetooth cổ điển (RFCOMM).
- **`open`:** socket RFCOMM theo SPP UUID, lỗi thì thử lại 1 lần; vẫn lỗi → `CONNECTION_FAILED`.
- **`write`:** ghi + `flush`; `BluetoothSocket` không có timeout ghi nên hẹn giờ đóng socket tại hạn, ghi xong thì huỷ
  hẹn; bị đóng do hẹn giờ → `WRITE_TIMEOUT` (sau đó `isOpen() == false`).
- **`read`:** `BluetoothSocket` không có timeout đọc → hỏi `available()` theo chu kỳ `READ_POLL_INTERVAL_MS` tới hạn.
- **`close`:** trước khi đóng chờ dữ liệu cuối kịp gửi (`flush` không bảo đảm máy in đã nhận) theo số byte lần ghi gần
  nhất; nếu `close` được gọi để cắt ngang (đang ghi) thì đóng ngay, không chờ.
- **`hardwareAddress`:** MAC.

#### `LanTransport`

- **Nhiệm vụ:** truyền byte qua TCP.
- **`open`:** `Socket.connect` timeout `LAN_CONNECT_TIMEOUT_MS` = 5 000; lỗi → `CONNECTION_FAILED`.
- **`write`:** ghi + `flush`; hẹn giờ đóng socket tại hạn như Bluetooth (rút dây mạng thường không làm socket báo lỗi
  ngay).
- **`read`:** `setSoTimeout(thời gian còn lại)`; `SocketTimeoutException` khi chưa có byte → mảng rỗng.
- **`hardwareAddress`:** `host:port`.

### 7.11 `device/monitor/`

#### `IDisconnectMonitor`

- **Hàm:** `void start()`, `void stop()` (gọi nhiều lần không sao).
- **Cài đặt:** `UsbDetachMonitor`, `BluetoothDisconnectMonitor`.

#### `UsbDetachMonitor`

- **Nhiệm vụ:** biết khi một thiết bị USB bị rút.
- **Dependency:** `Context`, `ConnectionPool`.
- **Làm:** receiver `ACTION_USB_DEVICE_DETACHED` (`RECEIVER_NOT_EXPORTED`) →
  `connectionPool.onHardwareLost(device.getDeviceName(), USB_DETACHED)`.
- **Không làm:** đóng kết nối hay việc chậm (chạy trên luồng UI).

#### `BluetoothDisconnectMonitor`

- **Nhiệm vụ:** biết khi kết nối Bluetooth tới một thiết bị mất.
- **Làm:** receiver `ACTION_ACL_DISCONNECTED` → `connectionPool.onHardwareLost(device.getAddress(),
  BLUETOOTH_DISCONNECTED)`.

LAN không có broadcast; mất kết nối LAN phát hiện qua lỗi ghi/đọc (`IO_ERROR`).

## 8. Hợp đồng JS ↔ native

Module JS: `DeviceModule`. Kiểu phía TS (`adapters/native/DeviceModule.ts`):

```ts
interface NativeUsbAddress {
  readonly type: 'usb';
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber: string | null;
}

interface NativeBluetoothAddress {
  readonly type: 'bluetooth';
  readonly mac: string;
}

interface NativeLanAddress {
  readonly type: 'lan';
  readonly host: string;
  readonly port: number;
}

type NativeDeviceAddress = NativeUsbAddress | NativeBluetoothAddress | NativeLanAddress;

interface NativeUsbDeviceInfo {
  readonly type: 'usb';
  readonly connectionId: string;
  readonly name: string | null;
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber: string | null;
  readonly manufacturerName: string | null;
  readonly productName: string | null;
  readonly hasPermission: boolean;
}

interface NativeBluetoothDeviceInfo {
  readonly type: 'bluetooth';
  readonly connectionId: string;
  readonly name: string | null;
  readonly mac: string;
}

type NativeDeviceInfo = NativeUsbDeviceInfo | NativeBluetoothDeviceInfo;

type DisconnectReason = 'usb_detached' | 'bluetooth_disconnected' | 'io_error';

interface DeviceDisconnectedEvent {
  readonly connectionId: string;
  readonly reason: DisconnectReason;
}
```

| Hàm | Tham số | Kết quả | Ghi chú |
|---|---|---|---|
| `discover(type)` | `'usb'` \| `'bluetooth'` | `NativeDeviceInfo[]` | Không mở hộp thoại quyền |
| `connect(address)` | `NativeDeviceAddress` | `connectionId` | Đang mở → trả `connectionId` đó |
| `write(connectionId, base64Data, timeoutMs)` | | `void` | Ghi đủ trong `timeoutMs`, không thì reject |
| `read(connectionId, maxBytes, timeoutMs)` | | base64 \| `null` | `null` khi hết `timeoutMs` mà không có byte |
| `disconnect(connectionId)` | | `void` | Chưa kết nối vẫn resolve |
| Sự kiện `DeviceDisconnected` | | `DeviceDisconnectedEvent` | Chỉ khi mất ngoài ý muốn, không khi JS gọi `disconnect` |

Kiểu ở cầu nối mang tiền tố `Native` để phân biệt với kiểu nghiệp vụ cùng nghĩa bên TS (`PrinterConnection`,
`PrinterConnectTarget`).

## 9. Quy tắc chi tiết

### 9.1 `connectionId` và kiểm tra địa chỉ

Trùng `identityKey` hiện có bên TS (`resolveIdentityKey`), để máy in đã lưu luôn có `connectionId === identityKey` mà
không phải đổi dữ liệu đã lưu:

| Loại | Định dạng | Ví dụ | Kiểm tra |
|---|---|---|---|
| USB có serial | `usb:<vendorId>:<productId>:<serialNumber>` | `usb:8137:8214:SN123` | vendorId/productId 0–65535 |
| USB không serial | `usb:<vendorId>:<productId>` | `usb:8137:8214` | serial rỗng coi là `null` |
| Bluetooth | `bluetooth:mac:<mac>` | `bluetooth:mac:66:22:A1:B2:C3:D4` | mac không rỗng |
| LAN | `lan:<host>:<port>` | `lan:192.168.1.50:9100` | host không rỗng, port 1–65535 |

vendorId/productId viết hệ thập phân; `mac` giữ nguyên như TS truyền (lấy từ `discover`, Android trả viết hoa).

### 9.2 `connectionId` suy ra từ địa chỉ, không từ thiết bị

Từ Android 10, `UsbDevice.getSerialNumber()` cần quyền USB, nên lúc quét chưa có quyền thì serial là `null`. Nếu sau
khi cấp quyền native tự thêm serial vào id thì id sẽ lệch với `identityKey` đã lưu — vì vậy id luôn tính từ địa chỉ TS
truyền vào.

### 9.3 Chọn thiết bị USB khi kết nối

1. Lấy các thiết bị đang cắm cùng vendorId + productId và có endpoint bulk OUT. Không có → `DEVICE_NOT_FOUND`.
2. Địa chỉ không có serial: đúng 1 thiết bị → dùng; nhiều hơn → `AMBIGUOUS_DEVICE`.
3. Địa chỉ có serial: duyệt ứng viên, thiết bị đã có quyền trước; thiết bị chưa có quyền thì xin quyền rồi đọc serial.
   Khớp → dùng; không ứng viên nào khớp → `DEVICE_NOT_FOUND`.
4. Thiết bị được chọn chưa có quyền → `UsbPermission.request`.

### 9.4 Xếp hàng, mất kết nối và chen ngang

| # | Tình huống | Hành vi | Nơi xử lý |
|---|---|---|---|
| 1 | Nhiều `write`/`read` liên tiếp trên một kết nối | Chạy đúng thứ tự gọi; hạn của mỗi thao tác tính lúc nó bắt đầu chạy | `Connection` |
| 2 | Hai `connect` đồng thời cùng địa chỉ | Mở một lần, cả hai nhận cùng `connectionId` | `ConnectionPool` |
| 3 | `connect` khi kết nối cùng địa chỉ đang mở và còn sống | Trả ngay `connectionId` | `ConnectionPool` |
| 4 | `connect` khi kết nối cùng địa chỉ đang mở nhưng đã chết | Bỏ kết nối cũ (abort, không phát sự kiện), mở mới | `ConnectionPool` |
| 5 | `connect` khi kết nối cùng địa chỉ đang đóng (`disconnect` chưa xong) | Chờ đóng xong rồi mới mở mới — không bao giờ mở 2 transport cùng thiết bị | `ConnectionPool` |
| 6 | `disconnect` khi đang ghi | Bỏ khỏi `openConnections` ngay (thao tác gọi sau → `NOT_CONNECTED`); các thao tác đã xếp trước chạy xong (tối đa tới hạn của chúng) rồi mới đóng | `ConnectionPool` + `Connection.close` |
| 7 | `disconnect` khi đang `connect` dở cùng địa chỉ | Chờ mở xong rồi đóng; `connect` vẫn resolve, sau đó kết nối đóng | `ConnectionPool` |
| 8 | `disconnect` với `connectionId` chưa mở | Resolve ngay | `ConnectionPool` |
| 9 | Rút USB / mất Bluetooth khi đang ghi | Bỏ khỏi pool, phát `DeviceDisconnected` 1 lần, `abort()`: thao tác đang chạy và đang chờ → `CONNECTION_LOST` (kèm `bytesWritten`) | Monitor → `ConnectionPool.loseConnection` → `Connection.abort` |
| 10 | Lỗi ghi tới trước broadcast rút USB | Thao tác đó trả mã gốc (`WRITE_FAILED`); `transport.isOpen()` false → mất kết nối `IO_ERROR`; broadcast tới sau bị bỏ qua (đã không còn trong pool) — sự kiện phát đúng 1 lần với lý do tới trước | `Connection` + `ConnectionPool` |
| 11 | Mất mạng LAN khi đang ghi, socket không báo lỗi | Hẹn giờ đóng socket tại hạn → `WRITE_TIMEOUT`; transport đã đóng → mất kết nối `IO_ERROR`, phát sự kiện | `LanTransport` + `Connection` + `ConnectionPool` |
| 12 | USB hết hạn khi ghi, thiết bị vẫn cắm | Trả `WRITE_TIMEOUT` kèm byte đã ghi; giữ kết nối | `UsbTransport` + `Connection` |
| 13 | Rút dây trong lúc `disconnect` đang chờ | Không phát sự kiện (JS đã chủ động đóng); đóng tiếp bình thường | `ConnectionPool` (đã không còn trong `openConnections`) |
| 14 | Rút dây khi hộp thoại quyền USB đang mở | `PERMISSION_DENIED` | `UsbPermission` |
| 15 | Rút dây khi đang `open` | `CONNECTION_FAILED` | Transport |
| 16 | `closeAll()` (JS reload) khi đang ghi | Abort mọi kết nối (không chờ), thao tác chưa xong → `CONNECTION_LOST`, không phát sự kiện; `connect` đang dở xong sau đó thì đóng ngay và reject `CONNECTION_LOST`; mọi lời gọi sau → `CONNECTION_LOST` | `ConnectionPool` |

## 10. Mã lỗi (`DeviceErrorCode`)

Reject bằng `promise.reject(code, message)`; `WRITE_*` và `CONNECTION_LOST` khi đang ghi thêm
`userInfo.bytesWritten`.

| Mã | Khi nào |
|---|---|
| `INVALID_ARGUMENT` | Địa chỉ/base64 sai; `timeoutMs`/`maxBytes` ≤ 0; `discover('lan')` |
| `DEVICE_NOT_FOUND` | Không thấy thiết bị khớp địa chỉ |
| `AMBIGUOUS_DEVICE` | Nhiều USB cùng vendorId/productId mà địa chỉ không có serial |
| `PERMISSION_DENIED` | Từ chối/hết giờ hộp thoại quyền USB; thiếu quyền Bluetooth |
| `BLUETOOTH_DISABLED` | Bluetooth tắt hoặc máy không có Bluetooth |
| `CONNECTION_FAILED` | Mở kết nối thất bại |
| `NOT_CONNECTED` | `write`/`read` với `connectionId` chưa mở hoặc đã `disconnect` |
| `CONNECTION_LOST` | Kết nối mất (hoặc `closeAll`) khi thao tác đang chạy/chờ |
| `WRITE_FAILED` | Lỗi I/O khi ghi |
| `WRITE_TIMEOUT` | Hết hạn khi chưa ghi đủ |
| `READ_NOT_SUPPORTED` | USB không có endpoint bulk IN |
| `READ_FAILED` | Lỗi I/O khi đọc |

Exception không phải `CodedException` (lỗi lập trình) → `DeviceModule` reject `INTERNAL_ERROR` và log.
TS ánh xạ mã sang `PrinterErrorCode` trong `NativeAdapter`.

### Luồng chạy

| Luồng | Tạo ở | Chạy gì |
|---|---|---|
| Luồng của native module | React Native | `DeviceModule` nhận lời gọi, gắn callback, trả về ngay |
| Luồng quét (1) | `DeviceFactory` → `DeviceService` | `discover` |
| Luồng mở kết nối (nhiều) | `DeviceFactory` → `ConnectionPool` | `TransportFactory.create` + `open` (chờ quyền USB tới 30s, socket tới 5s) |
| Luồng riêng của mỗi `Connection` | `ConnectionPool` (qua `operationExecutorFactory`) | `write`, `read`, `close` theo đúng thứ tự gọi |
| Luồng đóng khẩn (1) | `DeviceFactory` → `ConnectionPool` | `abort()` kết nối bị mất (đóng Bluetooth có thể chờ vài giây) |
| Luồng UI | Android | Broadcast của monitor, chỉ gọi `onHardwareLost` |

Executor truyền qua constructor để test chạy đồng bộ.

### Ví dụ: in 1 bill qua USB

```text
JS connect({ type: 'usb', vendorId, productId, serialNumber })
  DeviceModule → DeviceMapper.toAddress → DeviceService.connect → ConnectionPool.connect
  → luồng mở kết nối: TransportFactory.create → UsbDiscovery.find (xin quyền nếu cần) → new UsbTransport → open
  → new Connection → resolve "usb:8137:8214:SN123"

JS write("usb:8137:8214:SN123", base64Bill, 10000)
  → ConnectionPool.write → Connection.write (xếp hàng) → tới lượt: hạn = bây giờ + 10s
  → UsbTransport.write (chia khúc 16 KB) → resolve

Rút dây USB
  → UsbDetachMonitor → ConnectionPool.onHardwareLost("/dev/bus/usb/001/004", USB_DETACHED)
  → loseConnection: bỏ khỏi pool → IDisconnectListener → DeviceModule phát DeviceDisconnected
  → luồng đóng khẩn: Connection.abort() → thao tác đang chờ reject CONNECTION_LOST
```

## 11. Thay đổi phía TS (tối thiểu để app chạy với API mới)

- `adapters/native/PrinterNativeModule.ts` → `adapters/native/DeviceModule.ts`: kiểu và hàm theo §8;
  `subscribeDeviceDisconnected(callback: (event: DeviceDisconnectedEvent) => void)`.
- `adapters/native/NativeConnectionPool.ts` (mới): đếm số người dùng theo `connectionId` — `acquire(address)` gọi
  native `connect` khi là người đầu tiên, `release(connectionId)` gọi native `disconnect` khi là người cuối.
- `adapters/native/NativeAdapter.ts`: dùng `NativeConnectionPool`; lưu `connectionId`; `canRead = true`; `read()` gọi
  native; `getConnectionIdentity()` → `getConnectionId()`; ánh xạ mã lỗi §10; `listDevices` USB dùng `connectionId`
  làm `deviceId`.
- `adapters/IPrinterAdapter.ts`: `PrinterConnectTarget.usb` thêm `serialNumber`; `toConnectTarget` truyền serial.
- Xoá `transports/UsbTransport.ts` và test của nó (native đã chia khúc).
- Đổi theo tên mới: `EscPosDriver`, `TsplDriver`, `adapters/resolvePrinterAdapter.ts`,
  `connection/PrinterConnectionLock.ts`, `hooks/addPrinter/useConnectionSetup.ts`,
  `adapters/testing/MockPrinterAdapter.ts` và các test liên quan; `jest.setup.js` mock `NativeModules.DeviceModule`.
- Giữ khoá lệnh in hiện có (`PrintScheduler` + `PrinterConnectionLock`) — nguyên tắc 3.

## 12. File khác cần cập nhật

- `MainApplication.kt`: import + `add(NdtCorePosPackage())`.
- `AndroidManifest.xml`: comment đang nhắc `com.ndtcorepos.thermalprinter`.
- `android/app/build.gradle`: `testImplementation 'junit:junit:4.13.2'` và
  `testOptions.unitTests.returnDefaultValues = true` (lời gọi `android.util.Log` trong JUnit không làm test lỗi).
- `CLAUDE.md`, `docs/CODING_STANDARDS.md` (ví dụ tên interface ở Rule 8.3), `src/features/printer/ARCHITECTURE.md`
  (nếu nhắc native): đường dẫn và tên class mới.

## 13. Quy ước code (bắt buộc cho mọi file Java và TS mới/sửa)

Giống quy ước printer-core, cộng `docs/CODING_STANDARDS.md` (Java) và `docs/CODING_STANDARDS_TS.md` (TS).

1. **Summary ngắn, tiếng Việt.** Mỗi class/interface/type có 1 dòng summary nói trách nhiệm. Mỗi field có 1 dòng nói ý
   nghĩa + đơn vị (ms, byte…) + ràng buộc nếu có; bỏ qua field mà tên đã hiển nhiên tuyệt đối. Method chỉ có summary
   khi tên + tham số chưa đủ rõ.
2. **Không Javadoc rập khuôn.** Không `@param`/`@return` lặp lại tên và kiểu. Chỉ ghi khi có điều không hiển nhiên
   (đơn vị, mốc thời gian tuyệt đối…).
3. **Cách dòng:** 1 dòng trống giữa các field (kèm summary) và giữa các method; dòng trống giữa các khối logic trong
   hàm; không dòng trống thừa.
4. **Comment trong code:** tiếng Việt, 1–3 dòng, chỉ giải thích WHY (giới hạn phần cứng, hành vi Android không hiển
   nhiên). Không mô tả lại code, không kể lịch sử, **không tham chiếu tài liệu** (số mục spec, tên plan/task):
   comment phải tự đủ nghĩa khi đọc riêng. Comment cho Android API đặt ở đầu hàm (Rule 14.3).
5. **Độ dài dòng ≤ 120 ký tự**, đo bằng Node `line.length`.
6. **Nesting:** Java ≤ 2 cấp (Rule 3.3), TS ≤ 3 cấp; guard clause, không `else` sau `return`.
7. **1 hàm 1 trách nhiệm**; nhánh theo `DeviceType` chỉ điều phối, mỗi loại gọi 1 hàm riêng.
8. **Không magic number:** hằng `UPPER_SNAKE_CASE` có đơn vị (`PERMISSION_TIMEOUT_MS`, `USB_CHUNK_SIZE_BYTES`).
9. **Tên đầy đủ**, không viết tắt (`connection` không `conn`, `exception` không `e`); interface tiền tố `I`.
10. **Tham số:** ≥ 3 tham số thì mỗi tham số 1 dòng; ít hơn thì 1 dòng.
11. **TS import module khác qua barrel `index.ts`** nếu có.
12. **Verify trước mỗi commit:** `./gradlew :app:compileDebugJavaWithJavac` + `:app:testDebugUnitTest` (khi đụng
    Java), `npm run verify`, line-length.

Mẫu Java:

```java
/** Một kết nối đang mở; mọi thao tác chạy lần lượt trên một luồng riêng. */
final class Connection {

    private static final String LOG_SOURCE = "Connection";

    /** Mã kết nối, suy ra từ địa chỉ nên cùng địa chỉ luôn ra cùng mã. */
    private final String connectionId;

    private final ITransport transport;

    /** Một luồng duy nhất: ghi/đọc/đóng của cùng kết nối không bao giờ chạy song song. */
    private final ExecutorService operationExecutor;

    /** Báo pool khi transport không còn dùng được sau một lỗi. */
    private final Runnable transportLostHandler;

    Connection(
            String connectionId,
            ITransport transport,
            ExecutorService operationExecutor,
            Runnable transportLostHandler) {
        this.connectionId = connectionId;
        this.transport = transport;
        this.operationExecutor = operationExecutor;
        this.transportLostHandler = transportLostHandler;
    }

    /** Hạn ghi tính từ lúc tới lượt chạy, không tính thời gian chờ thao tác trước. */
    CompletableFuture<Void> write(byte[] data, long timeoutMillis) {
        return CompletableFuture.runAsync(() -> writeBeforeDeadline(data, timeoutMillis), operationExecutor);
    }
}
```

Mẫu TS:

```ts
/** Thiết bị USB `discover` tìm thấy, chưa kết nối. */
export interface NativeUsbDeviceInfo {
  readonly type: 'usb';

  /** Mã kết nối native sẽ trả khi `connect` thiết bị này. */
  readonly connectionId: string;

  /** `null` khi chưa có quyền USB (Android 10+ cần quyền mới đọc được serial). */
  readonly serialNumber: string | null;

  /** App đã được cấp quyền USB cho thiết bị này chưa; quét không mở hộp thoại xin quyền. */
  readonly hasPermission: boolean;
}
```

## 14. Test

**JUnit** (`android/app/src/test/java/com/ndtcorepos/`, cùng cấu trúc package):

```text
test/java/com/ndtcorepos/
├── common/CodedExceptionTest.java
└── device/
    ├── DeviceServiceTest.java           # chọn discovery theo loại; LAN → INVALID_ARGUMENT; close tắt monitor + pool
    ├── model/DeviceAddressTest.java     # kiểm tra tham số; connectionId đúng §9.1, trùng resolveIdentityKey bên TS
    ├── discovery/UsbDiscoveryTest.java  # chooseCandidate: không có, một, nhiều không serial, serial khớp/không
    ├── connection/
    │   ├── FakeTransport.java           # ITransport giả: điều khiển được ghi chậm, lỗi, hết hạn, isOpen
    │   ├── FakeTransportFactory.java
    │   ├── ConnectionTest.java
    │   └── ConnectionPoolTest.java
    └── transport/UsbTransportTest.java  # chia khúc 40 KB → 16/16/8; hết hạn → WRITE_TIMEOUT kèm byte đã ghi
```

`ConnectionTest` và `ConnectionPoolTest` phủ đủ 16 tình huống ở §9.4 (trừ #14, #15 cần thiết bị thật), mỗi tình huống
ít nhất một test.

`bridge/` không có unit test (chỉ đổi kiểu và gọi xuống); kiểm qua Jest phía TS và máy thật.

**Jest** (TS): `NativeConnectionPool` (đếm người dùng, connect/disconnect đúng lúc), `NativeAdapter` (ánh xạ mã lỗi,
`read`, truyền serial) với `NativeModules` giả.

**Kiểm tra trên máy thật** (bắt buộc):

1. USB: hộp thoại quyền — đồng ý, từ chối, rút dây khi hộp thoại đang mở.
2. USB: in bill ESC/POS và tem TSPL có ảnh lớn hơn 16 KB.
3. USB: rút dây lúc rảnh và lúc đang in → app nhận mất kết nối đúng một lần; cắm lại kết nối được.
4. USB: 2 máy cùng model (nếu có) → in đúng máy; rút một máy không ảnh hưởng máy kia.
5. TSPL qua USB: `read` nhận phản hồi lệnh dò (nếu máy có endpoint IN).
6. Bluetooth: kết nối, in, ra khỏi tầm sóng → mất kết nối; tắt Bluetooth → `BLUETOOTH_DISABLED`.
7. LAN: kết nối, in; IP sai → `CONNECTION_FAILED` sau khoảng 5s; rút dây mạng khi đang in → `WRITE_TIMEOUT` rồi
   `DeviceDisconnected`; app không treo.
8. Đang in một máy thì kết nối/in máy khác → không phải chờ.
9. Bấm ngắt kết nối khi đang in → lệnh in đang chạy hoàn tất (hoặc hết hạn) rồi mới đóng; không có sự kiện mất kết nối.
10. Reload JS nhiều lần, kể cả khi đang in → không rò kết nối (kết nối lại được ngay).

## 15. Tiêu chí hoàn thành

- Cấu trúc và tên đúng §5–§7; `com/ndtcorepos/thermalprinter/` đã xoá.
- API JS đúng §8; native không còn `printerId`.
- 16 tình huống §9.4 có test (JUnit hoặc kiểm tra trên máy thật).
- `grep` `thermalprinter`, `ThermalPrinterModule`, `getConnectionIdentity` trong code và tài liệu đang dùng ra rỗng
  (trừ spec/plan cũ).
- 10 hành vi trong bảng §4 đều có test tự động hoặc mục kiểm tra trên máy thật.
- `./gradlew :app:testDebugUnitTest` xanh; `npm run verify` xanh.
- Danh sách kiểm tra trên máy thật đã chạy, kết quả ghi trong PR.

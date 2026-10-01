# Tầng native thiết bị (`com.ndtcorepos`) — Design Spec

## 1. Mục tiêu

Thiết kế mới tầng native Android (Java) của app, thay toàn bộ `com.ndtcorepos.thermalprinter`.

Tầng native chỉ làm "đường ống" tới thiết bị ngoại vi: **tìm thiết bị, xin quyền, kết nối, ghi/đọc byte, báo mất kết
nối**. Native nhận **địa chỉ thiết bị**, trả về **`connectionId`** của kết nối đã mở; không biết `printerId`, máy in đã
lưu, giao thức (ESC/POS, TSPL), khổ giấy hay loại bản in — những thứ đó thuộc tầng TS.

## 2. Nguyên tắc

1. **Tách định danh thiết bị khỏi định danh kết nối.**
   - `deviceId`: định danh một thiết bị trong kết quả quét, chỉ ổn định trong lần cắm hiện tại; dùng làm key danh sách
     trên UI.
   - `connectionId`: định danh một kết nối **đã mở**, native xác định từ thiết bị vật lý thật sau khi tìm ra nó. Là mã
     mờ **theo hợp đồng**: TS chỉ dùng cho `write`/`read`/`disconnect` và sự kiện, **không phân tích, không lưu**.
     Định dạng ở §9.1 là chi tiết bên trong native (để đọc log), có thể đổi mà TS không phải sửa; native không chặn
     được việc TS phân tích nên quy tắc này giữ bằng review.
   - Danh tính máy in đã lưu (`identityKey`) là việc của TS; native cung cấp serial (đọc được sau khi có quyền) trong
     kết quả `connect` để TS lưu danh tính đầy đủ.
2. **Một thiết bị vật lý = một `Connection`.** Hai lời gọi `connect` với địa chỉ khác nhau (có/không serial) nhưng cùng
   trỏ tới một máy nhận cùng `connectionId` và dùng chung kết nối. Native không biết hai đường truyền (USB và LAN) có
   phải cùng một máy hay không — "một máy in nhiều đường kết nối" là việc của TS.
3. **Native bảo đảm thứ tự từng thao tác; TS bảo đảm trọn vẹn từng lệnh in.** Trên một kết nối, `write`/`read`/
   `disconnect` chạy đúng thứ tự gọi, không chồng nhau (một hàng đợi I/O duy nhất, ở native). Một lệnh in gồm nhiều lần
   gọi (dò → đọc → ghi nội dung), nên **TS giữ khoá lệnh in** (`PrintScheduler` + `PrinterConnectionLock`) để mỗi kết
   nối chỉ chạy một lệnh in tại một thời điểm. Khoá này không phải hàng đợi I/O thứ hai.
4. **Một nơi sở hữu mỗi trạng thái.** Kết nối native đang mở: chỉ `ConnectionPool`. Số nơi đang dùng một kết nối: chỉ
   `NativeConnectionPool` bên TS. Native: `connect` lại thiết bị đang mở trả về kết nối đó; `disconnect` đóng ngay (sau
   khi thao tác đã xếp trước chạy xong).
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
| 1 | Kết nối USB chỉ tìm theo vendorId/productId → 2 máy cùng model luôn lấy máy đầu | Khớp serial, rồi `devicePath`; không chọn được thì báo lỗi (§9.2) |
| 2 | Rút 1 máy USB, máy cùng model cũng bị coi là mất | Khớp theo đường dẫn thiết bị (`hardwareAddress`) |
| 3 | Rút USB được xử lý ở 2 nơi không phối hợp | Một đường duy nhất: monitor → `ConnectionPool` |
| 4 | Ghi chặn luồng native module tới 15s; kết nối chặn tới 30s khi chờ hộp thoại quyền USB | Chạy trên luồng riêng |
| 5 | USB ghi cả payload 1 lần; ghi thiếu byte vẫn báo thành công | Chia khúc, ghi đủ mới thành công |
| 6 | Timeout ghi Bluetooth/LAN bị bỏ qua; 2 mức timeout chồng nhau | Một hạn do TS truyền |
| 7 | Native không đọc được phản hồi | Có `read` |
| 8 | Receiver nhận cả broadcast từ app khác | Receiver chỉ nhận trong app |
| 9 | `Toast` tiếng Anh từ native | Bỏ |
| 10 | Kết quả "ghi" dùng cho cả mở/đóng kết nối | Lỗi là `DeviceException`, thành công không trả gì |
| 11 | Danh tính USB lưu thiếu serial khi quét lúc chưa có quyền | `connect` trả serial để TS lưu đủ |

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
│       ├── DeviceMapper.java
│       └── BridgeLimits.java
│
├── common/
│   └── CodedException.java
│
└── device/
    ├── DeviceFactory.java
    ├── DeviceService.java
    ├── model/
    │   ├── DeviceAddress.java
    │   ├── DeviceInfo.java
    │   └── ConnectedDevice.java
    ├── enums/
    │   ├── TransportType.java
    │   └── DisconnectReason.java
    ├── constants/
    │   ├── TransportConstants.java
    │   └── PermissionConstants.java
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
    │   ├── StreamWriter.java
    │   ├── UsbTransport.java
    │   ├── BluetoothTransport.java
    │   └── LanTransport.java
    └── monitor/
        ├── IDisconnectMonitor.java
        ├── UsbDetachMonitor.java
        └── BluetoothDisconnectMonitor.java
```

33 file Java. Xoá toàn bộ `com/ndtcorepos/thermalprinter/`.

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
2. `bridge/` chỉ dùng `DeviceFactory`, `DeviceService`, `model/`, `enums/`, `error/`,
   `connection/IDisconnectListener`.
3. Các folder trong `device/` gọi theo đúng hướng trên, không gọi ngược. `model/`, `enums/`, `constants/`, `error/` là
   lá: folder nào cũng được dùng, còn chúng không dùng folder nghiệp vụ nào.
4. `common/`, `model/`, `enums/`, `constants/`, `error/`, `connection/`, `DeviceService`, `transport/StreamWriter`
   không dùng API Android → test bằng JUnit thuần.
5. **Quyền sở hữu:** `DeviceFactory` là composition root — lắp các dependency sống suốt vòng đời service rồi tạo
   `DeviceService`. Đối tượng thuộc quyền sở hữu của class nào thì class đó tạo (`TransportFactory` tạo transport,
   `ConnectionPool` tạo `Connection`). Mọi dependency khác nhận qua constructor; không class nào gọi lại
   `DeviceFactory`. Không dùng DI framework.
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
| `device/model/` | Dữ liệu bất biến: địa chỉ, thiết bị tìm thấy, kết quả kết nối | Logic, gọi Android |
| `device/enums/` | Tập giá trị cố định trao đổi với JS: loại đường truyền, lý do mất kết nối | Logic ngoài đổi `wireValue` |
| `device/constants/` | Hằng cấu hình chỉnh theo phần cứng: chunk, timeout, thời gian chờ đóng Bluetooth, thời gian chờ quyền | Hằng nội bộ của một class (trạng thái, UUID, giới hạn kiểm tra địa chỉ) |
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
  | `discover(String type, Promise)` | `deviceService.discover(mapper.toTransportType(type))` |
  | `connect(ReadableMap address, Promise)` | `deviceService.connect(mapper.toAddress(address))` |
  | `write(String connectionId, String base64Data, double timeoutMs, Promise)` | `deviceService.write(…)` |
  | `read(String connectionId, double maxBytes, double timeoutMs, Promise)` | `deviceService.read(…)` |
  | `disconnect(String connectionId, Promise)` | `deviceService.disconnect(connectionId)` |

- **`invalidate()`** (React Native gọi khi reload/huỷ module): `deviceService.close()`.
- **`onDisconnected(connectionId, reason)`:** phát `DeviceDisconnected { connectionId, reason }`; bỏ qua nếu React
  không còn chạy.
- **Quy tắc:**
  - Không bao giờ đứng chờ: gắn callback vào `CompletableFuture`. Thành công → resolve; `CodedException` → reject bằng
    `code()` + message (kèm `userInfo.bytesWritten` khi có); exception khác → reject `INTERNAL_ERROR` và log.
  - Callback tới sau `invalidate()` vẫn resolve/reject bình thường (React Native bỏ qua Promise của instance đã huỷ);
    không bao giờ để Promise treo.
  - Số từ JS là `double` → đổi sang `long`/`int` qua `DeviceMapper`; ngoài khoảng cho phép → `INVALID_ARGUMENT`.
  - `INTERNAL_ERROR` là mã **chỉ có ở bridge** (hằng trong `DeviceModule`, không thuộc `DeviceErrorCode`): báo lỗi lập
    trình, TS coi như lỗi không xác định.
- **Không làm:** quyết định kết nối, xếp hàng, đọc/ghi thiết bị.

#### `device/DeviceMapper`

- **Nhiệm vụ:** đổi dữ liệu giữa kiểu React Native và kiểu `device/model`.
- **Hàm:**
  - `TransportType toTransportType(String wireValue)` — sai → `INVALID_ARGUMENT`.
  - `DeviceAddress toAddress(ReadableMap map)` — đọc `type` rồi các trường theo loại; thiếu/sai kiểu →
    `INVALID_ARGUMENT`.
  - `WritableArray toWritableArray(List<DeviceInfo> devices)` — đúng dạng TS (§8).
  - `WritableMap toWritableMap(ConnectedDevice connectedDevice)`.
  - `byte[] toBytes(String base64Data)` — base64 sai → `INVALID_ARGUMENT`.
  - `String toBase64OrNull(byte[] data)` — mảng rỗng → `null`.
  - `long toTimeoutMillis(double timeoutMs)` — phải trong 1..`MAX_OPERATION_TIMEOUT_MS` = 600 000 (10 phút; chặn
    trên để phép cộng hạn không tràn số).
  - `int toMaxBytes(double maxBytes)` — phải trong 1..`MAX_READ_BYTES` = 65 536 (không cấp phát mảng khổng lồ theo
    tham số từ JS).
  - `WritableMap toDisconnectedEvent(String connectionId, DisconnectReason reason)`.
- **Không làm:** gọi `DeviceService`.

#### `device/BridgeLimits`

- **Nội dung:** giới hạn tham số số học nhận từ JS, `DeviceMapper` dùng: `MAX_READ_BYTES` = 65 536,
  `MAX_OPERATION_TIMEOUT_MS` = 600 000. Class `final`, chỉ dùng trong package `bridge/device`.

### 7.3 `common/`

#### `CodedException`

- **Nhiệm vụ:** lớp cha trừu tượng của mọi lỗi có mã (`abstract String code()`), để `bridge/` reject Promise bằng mã
  mà không cần biết lỗi từ tính năng nào.
- **Không làm:** chứa mã lỗi cụ thể (mỗi tính năng tự có enum mã).

### 7.4 `device/` gốc

#### `DeviceFactory`

- **Nhiệm vụ:** composition root của device — lắp các dependency sống suốt vòng đời service.
- **Hàm:** `static DeviceService create(Context context, IDisconnectListener listener)`:
  1. Lấy `UsbManager`, tạo `UsbPermission`, `UsbDiscovery`, `BluetoothDiscovery`.
  2. Tạo `TransportFactory(usbManager, usbDiscovery, bluetoothDiscovery, timerExecutor)`.
  3. Tạo executor: luồng quét (1), luồng mở kết nối (nhiều), luồng đóng khẩn (1), luồng hẹn giờ ghi (1, scheduled),
     và cách tạo luồng riêng cho mỗi `Connection`. Executor nào giao cho class nào thì class đó tắt (bảng "Luồng
     chạy" ở §10); `DeviceFactory` không giữ lại tham chiếu.
  4. Tạo `ConnectionPool(…)`, `UsbDetachMonitor`, `BluetoothDisconnectMonitor`.
  5. Tạo `DeviceService(…)`, gọi `start()`, trả về service đã sẵn sàng.
- **Không làm:** logic nghiệp vụ; tạo đối tượng thuộc quyền sở hữu của class khác (transport, `Connection`).

#### `DeviceService`

- **Nhiệm vụ:** cửa vào duy nhất của device cho `bridge/`; điều phối discovery và `ConnectionPool`; quản lý vòng đời.
- **Constructor** (mỗi tham số 1 dòng): `Map<TransportType, IDeviceDiscovery> discoveries`,
  `ConnectionPool connectionPool`, `List<IDisconnectMonitor> monitors`, `ExecutorService discoveryExecutor`,
  `ScheduledExecutorService timerExecutor`.
- **Hàm:**

  | Hàm | Làm gì |
  |---|---|
  | `start()` (package-private) | Bật mọi monitor; chỉ `DeviceFactory` gọi, đúng 1 lần |
  | `CompletableFuture<List<DeviceInfo>> discover(TransportType type)` | Chọn discovery theo loại, chạy trên luồng quét; không có (LAN) → `INVALID_ARGUMENT` |
  | `CompletableFuture<ConnectedDevice> connect(DeviceAddress address)` | `connectionPool.connect(address)` |
  | `CompletableFuture<Void> write(String connectionId, byte[] data, long timeoutMillis)` | `connectionPool.write(…)` |
  | `CompletableFuture<byte[]> read(String connectionId, int maxBytes, long timeoutMillis)` | `connectionPool.read(…)` |
  | `CompletableFuture<Void> disconnect(String connectionId)` | `connectionPool.disconnect(connectionId)` |
  | `close()` | Gọi nhiều lần không sao: tắt luồng quét (lần quét đang chạy được chạy xong), tắt monitor, `connectionPool.closeAll()`, tắt luồng hẹn giờ ghi |

- Sau `close()`: mọi lời gọi → `SERVICE_CLOSED`.
- **Không làm:** gọi Android API; tự tạo dependency.

### 7.5 `device/model/`, `device/enums/`, `device/constants/`

Tất cả bất biến (field `final`, không setter), không gọi Android.

#### `enums/TransportType`

- **Nội dung:** loại đường truyền tới thiết bị (không phải loại thiết bị: một máy in có thể vừa USB vừa LAN). Enum
  `USB`, `BLUETOOTH`, `LAN`; `wireValue()` = `"usb"`, `"bluetooth"`, `"lan"`;
  `static TransportType fromWireValue(String)` — sai → `INVALID_ARGUMENT`.

#### `enums/DisconnectReason`

- **Nội dung:** enum `USB_DETACHED`, `BLUETOOTH_DISCONNECTED`, `IO_ERROR`; `wireValue()` = `"usb_detached"`,
  `"bluetooth_disconnected"`, `"io_error"`.

#### `constants/TransportConstants`, `constants/PermissionConstants`

- **Nhiệm vụ:** gom các hằng cấu hình có thể phải chỉnh theo máy in thực tế (class `final`, constructor `private`,
  field `public static final`, mỗi field có summary). Class dùng hằng nhập bằng `import static`.
- `TransportConstants`: `USB_CHUNK_SIZE_BYTES`, `STREAM_CHUNK_SIZE_BYTES`, `LAN_CONNECT_TIMEOUT_MS`,
  `READ_POLL_INTERVAL_MS`, `DRAIN_MIN_WAIT_MS`, `DRAIN_SMALL_PAYLOAD_BYTES`, `DRAIN_BYTES_PER_MS`.
- `PermissionConstants`: `PERMISSION_TIMEOUT_MS`.
- Giới hạn tham số từ JS (`MAX_READ_BYTES`, `MAX_OPERATION_TIMEOUT_MS`) thuộc bridge nên ở
  `bridge/device/BridgeLimits`.
- **Không chứa:** hằng nội bộ chỉ có nghĩa trong một class (trạng thái của `StreamWriter`, UUID SPP, action intent
  quyền USB, giới hạn kiểm tra trong `DeviceAddress`, tên module/sự kiện của bridge).

#### `model/DeviceAddress`

- **Nhiệm vụ:** cách tới một thiết bị.
- **Tạo bằng** (kiểm tra tham số ngay, sai → `DeviceException(INVALID_ARGUMENT)`):
  - `usb(int vendorId, int productId, String serialNumber, String devicePath)` — vendorId/productId 0–65535;
    `serialNumber`, `devicePath` tuỳ chọn, rỗng coi là `null`.
  - `bluetooth(String mac)` — không rỗng; **chuẩn hoá viết hoa**.
  - `lan(String host, int port)` — host không rỗng; port 1–65535.
- **Field:** `type`, `vendorId`, `productId`, `serialNumber`, `devicePath` (USB), `mac` (Bluetooth), `host`, `port`
  (LAN). Field không thuộc loại để `null`/0.
- **Hàm:** `String lookupKey()` — khoá để gộp các `connect` đồng thời cùng địa chỉ **trước khi** tìm ra thiết bị
  (vd `usb:8137:8214:SN123`, `usb:8137:8214:@/dev/bus/usb/001/004`, `bluetooth:66:22:A1:B2:C3:D4`,
  `lan:192.168.1.50:9100`).

#### `model/DeviceInfo`

- **Nhiệm vụ:** một thiết bị tìm thấy khi quét.
- **Field:** `deviceId`, `type`, `name`, `address` (`DeviceAddress` để TS truyền lại nguyên vẹn khi `connect`); USB
  thêm `manufacturerName`, `productName`, `hasPermission`.
- `deviceId`: USB = `usb:` + đường dẫn thiết bị; Bluetooth = `bluetooth:` + MAC.
- `address` USB có `devicePath` = đường dẫn thiết bị và `serialNumber` nếu đã có quyền (không thì `null`).

#### `model/ConnectedDevice`

- **Nhiệm vụ:** kết quả `connect`.
- **Field:** `connectionId`; `serialNumber` — serial đọc từ thiết bị sau khi mở (USB), `null` nếu thiết bị không có
  hoặc đường truyền không hỗ trợ.

### 7.6 `device/error/`

#### `DeviceErrorCode`

- **Nội dung:** enum 13 mã (§10).

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
  - `discover()` — thiết bị có interface chứa endpoint bulk OUT; đọc serial nếu đã có quyền; tên = `productName`,
    không có thì đường dẫn thiết bị. **Không** mở hộp thoại quyền.
  - `UsbDevice find(DeviceAddress address) throws DeviceException` — luật §9.2; có thể xin quyền nên chỉ gọi từ luồng
    mở kết nối.
  - `static <T> T chooseCandidate(…)` — luật chọn thuần, để test JUnit; nhận danh sách ứng viên, serial và
    `devicePath` mong muốn, và `ISerialReader<T>` (interface lồng trong `UsbDiscovery`:
    `String readSerial(T candidate) throws DeviceException`, xin quyền nếu cần).
- **Không làm:** mở kết nối USB.

#### `BluetoothDiscovery`

- **Nhiệm vụ:** liệt kê thiết bị Bluetooth đã ghép đôi; tìm theo MAC.
- **Dependency:** `Context` (lấy `BluetoothManager`).
- **Hàm:**
  - `discover()` — mọi thiết bị đã ghép đôi; MAC viết hoa.
  - `BluetoothDevice findBonded(String mac) throws DeviceException` — so khớp không phân biệt hoa/thường; không có →
    `DEVICE_NOT_FOUND`.
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
    đó (so đường dẫn thiết bị); `PendingIntent` gắn package của app; xong thì huỷ receiver.
  - Chờ tối đa `PERMISSION_TIMEOUT_MS` = 30 000; từ chối / hết giờ / rút dây khi hộp thoại đang mở →
    `PERMISSION_DENIED`.
  - Luồng chờ bị ngắt (`closeAll` khi reload JS) → dừng chờ ngay, giữ cờ interrupt, huỷ receiver trong `finally`. Hộp
    thoại hệ thống vẫn có thể còn trên màn hình (Android không có API đóng nó); câu trả lời tới sau bị bỏ qua.
- **Không làm:** quyền Bluetooth/Location (TS xin qua `PrinterPermissionService`).

### 7.9 `device/connection/`

Không dùng API Android.

#### `IDisconnectListener`

- **Nhiệm vụ:** cách `ConnectionPool` báo ra ngoài khi một kết nối mất ngoài ý muốn.
- **Hàm:** `void onDisconnected(String connectionId, DisconnectReason reason)`.
- **Cài đặt:** `DeviceModule`.

#### `ConnectionPool`

- **Nhiệm vụ:** nơi duy nhất sở hữu các kết nối native đang mở; mở, dùng lại, đóng; xử lý mất kết nối và chen ngang
  (§9.3).
- **Constructor** (mỗi tham số 1 dòng): `ITransportFactory transportFactory`, `IDisconnectListener listener`,
  `ExecutorService connectExecutor`, `ExecutorService abortExecutor`,
  `Supplier<ExecutorService> operationExecutorFactory`.
- **Trạng thái** (mọi đọc/ghi trong một khoá chung `lock` của pool):
  - `entries`: `connectionId → Entry` — mỗi thiết bị đang mở dở, đang mở hoặc đang đóng có **đúng một** `Entry`
    (class lồng, riêng tư):
    - `state`: `OPENING` (đã giữ chỗ, transport đang mở) → `OPEN` → `CLOSING` (đang `disconnect`). Không có trạng thái
      "đã đóng": đóng xong hoặc mất kết nối thì bỏ `Entry` khỏi map.
    - `connection`: `null` khi `OPENING`.
    - `transition`: future hoàn tất khi lần mở (`OPENING`) hoặc lần đóng (`CLOSING`) đang diễn ra xong; bên muốn dùng
      thiết bị chờ nó rồi giữ chỗ lại từ đầu.
  - `pendingByLookupKey`: `lookupKey → future` các `connect` đang chạy (gộp cùng địa chỉ, **trước khi** biết là thiết
    bị nào nên phải tách khỏi `entries`).
  - `closed`: đã `closeAll()`.
- **Bất biến:**
  1. **Giữ chỗ trước khi mở.** `transportFactory.create` trả transport **chưa mở**. Trong khoá, `reserve` chỉ trả về
     một trong ba: dùng lại `Entry` `OPEN` còn sống; chờ `transition` của `Entry` đang `OPENING`/`CLOSING`; hoặc tạo
     `Entry` `OPENING` mới và được quyền mở. Vì vậy một thiết bị không bao giờ có 2 transport cùng mở; bên không được
     mở gọi `abort()` transport thừa của mình.
  2. **Đổi trạng thái trong khoá rồi mới hoàn tất `transition`** (callback của bên chờ chạy ngay lúc hoàn tất, có thể
     gọi lại vào pool).
  3. **`OPEN → CLOSING` là một bước trong khoá.** `write`/`read` lấy kết nối trong cùng khoá: lấy trước bước đó thì
     thao tác được xếp vào `Connection` trước lệnh `close` (hoặc nhận `NOT_CONNECTED` nếu `Connection` đã nhận
     `close`); lấy sau thì nhận `NOT_CONNECTED`. Không thao tác nào chạy sau khi transport đóng.
  4. Sau `closed = true` không thêm `Entry` `OPEN` nào: bước đưa kết nối vào pool kiểm tra `closed` trong khoá, đã
     đóng thì `abort()` và báo `SERVICE_CLOSED`.
- **Hàm:**

  | Hàm | Làm gì |
  |---|---|
  | `CompletableFuture<ConnectedDevice> connect(DeviceAddress address)` | Theo §9.3; trên luồng mở kết nối: `transportFactory.create(address)` → `connectionId` = `address.type().wireValue() + ":" + transport.hardwareAddress()` → giữ chỗ (dùng lại / chờ / mở) → `ConnectedDevice(connectionId, connection.serialNumber())`. Lỗi khi pool đã đóng → `SERVICE_CLOSED` thay cho lỗi gốc |
  | `CompletableFuture<Void> write(String connectionId, byte[] data, long timeoutMillis)` | Không có `Entry` `OPEN` → `NOT_CONNECTED`; có → `connection.write` |
  | `CompletableFuture<byte[]> read(String connectionId, int maxBytes, long timeoutMillis)` | Như `write` |
  | `CompletableFuture<Void> disconnect(String connectionId)` | Không có `Entry` → resolve; `OPENING` → chờ `transition` (thành công hay lỗi) rồi gọi lại `disconnect`; `CLOSING` → trả `transition` đang có; `OPEN` → `CLOSING`, `transition` = `connection.close()`, xong thì bỏ `Entry` |
  | `void onHardwareLost(String hardwareAddress, DisconnectReason reason)` | Monitor gọi; tìm `Entry` `OPEN` có `hardwareAddress` trùng (so không phân biệt hoa/thường) → `loseConnection` |
  | `void closeAll()` | Trong khoá: `closed = true`, gom `Connection` của mọi `Entry`, xoá `entries`, `connectExecutor.shutdownNow()` (ngắt luồng đang chờ quyền USB / mở socket), `abortExecutor.shutdown()`; ngoài khoá: `abort()` từng kết nối. Không phát sự kiện |

- **Hàm riêng:** `loseConnection(connection, reason)` — dùng chung cho monitor và lỗi I/O; là nơi **duy nhất**
  chuyển một kết nối sang "mất": trong khoá, chỉ khi `Entry` còn `OPEN` và đúng `connection` này thì bỏ `Entry` và
  giao `connection.abort()` cho luồng đóng khẩn (không thì bỏ qua, nên mỗi kết nối báo đúng một lần); ngoài khoá báo
  `listener`.
- **Không làm:** biết USB/Bluetooth/LAN cụ thể.

#### `Connection`

- **Nhiệm vụ:** một kết nối đang mở; hàng đợi I/O duy nhất của kết nối đó; quyết định mã lỗi khi bị cắt ngang.
- **Constructor** (mỗi tham số 1 dòng): `String connectionId`, `ITransport transport`,
  `ExecutorService operationExecutor`, `Consumer<Connection> transportLostHandler`.
- **Trạng thái** (chuyển trạng thái đồng bộ): `OPEN` → `CLOSING` (đã xếp `close`) → `CLOSED`; hoặc `OPEN`/`CLOSING`
  → `ABORTED`. Không có `OPENING`: `Connection` chỉ được tạo sau khi transport mở thành công.
- **Hàm:**

  | Hàm | Làm gì |
  |---|---|
  | `CompletableFuture<Void> write(byte[] data, long timeoutMillis)` | Xếp hàng; tới lượt: `deadlineNanos` = `System.nanoTime()` + timeout → `transport.write(data, deadlineNanos)` |
  | `CompletableFuture<byte[]> read(int maxBytes, long timeoutMillis)` | Như `write` với `transport.read` |
  | `CompletableFuture<Void> close()` | Xếp sau các thao tác trước; tới lượt: `transport.close()` (đóng bình thường), tắt luồng |
  | `void abort()` | Không chờ: `ABORTED`, `transport.abort()` ngay (giải phóng luồng đang kẹt), hoàn tất các thao tác đang chờ với `CONNECTION_LOST`, tắt luồng; thao tác đang chạy tự kết thúc khi transport đóng |
  | `String hardwareAddress()`, `String serialNumber()` | Lấy từ transport |
  | `boolean isAlive()` | `OPEN` và `transport.isOpen()` |

- **Quy tắc lỗi:**
  - Đã `ABORTED` → mọi thao tác (đang chạy hoặc đang chờ) kết thúc với `CONNECTION_LOST`, giữ `bytesWritten` của thao
    tác đang chạy.
  - `close()` và `abort()` gặp nhau → `abort()` thắng; future của `close()` vẫn hoàn tất thành công (kết nối đằng nào
    cũng đã đóng).
  - Thao tác lỗi (kể cả hết hạn) mà sau đó `transport.isOpen() == false` → gọi `transportLostHandler`
    (`ConnectionPool` xử lý như mất kết nối `IO_ERROR`) **trước** khi trả lỗi, để nơi gọi thử lại ngay không rơi vào
    kết nối đã chết; thao tác đó vẫn trả mã lỗi gốc.
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
  | `void write(byte[] data, long deadlineNanos) throws DeviceException` | Ghi đủ toàn bộ hoặc ném `WRITE_TIMEOUT`/`WRITE_FAILED` kèm **số byte của các khúc đã ghi xong** (có thể đếm thiếu, không bao giờ đếm thừa) |
  | `byte[] read(int maxBytes, long deadlineNanos) throws DeviceException` | §9.4: trả ngay khi có ≥ 1 byte (tối đa `maxBytes`); hết hạn không có byte → mảng rỗng; lỗi → `READ_FAILED` |
  | `void close()` | **Đóng bình thường**: chỉ gọi khi không còn thao tác nào đang chạy (`Connection.close` tới lượt); được phép chờ dữ liệu cuối gửi xong; không ném lỗi |
  | `void abort()` | **Cắt ngay**, không chờ; gọi được từ luồng khác trong lúc đang ghi/đọc để giải phóng luồng đang kẹt; gọi nhiều lần không sao; không ném lỗi. Cũng dùng để huỷ transport chưa mở |
  | `boolean isOpen()` | Phản ánh đúng việc còn dùng được không, kể cả sau lỗi |
  | `String hardwareAddress()` | Địa chỉ phần cứng: tạo `connectionId` và để monitor khớp |
  | `String serialNumber()` | Serial đọc từ thiết bị (USB); `null` nếu không có |

- `deadlineNanos` là mốc tuyệt đối theo `System.nanoTime()`: không lệch khi đồng hồ hệ thống đổi (đồng bộ NTP), và
  một lần ghi nhiều khúc không cộng dồn timeout.
- Tách `close` và `abort` để transport không phải tự đoán ý định (đóng bình thường hay cắt ngang). Transport không có
  gì cần chờ thì `close()` gọi thẳng `abort()`.

#### `ITransportFactory`

- **Hàm:** `ITransport create(DeviceAddress address) throws DeviceException` — tìm thiết bị (có thể xin quyền USB) và
  tạo transport **chưa mở**; được phép chặn; chỉ gọi từ luồng mở kết nối.
- **Cài đặt:** `TransportFactory`; test dùng bản giả.

#### `TransportFactory`

- **Nhiệm vụ:** tạo đúng transport cho một địa chỉ (sở hữu việc tạo transport).
- **Dependency:** `UsbManager`, `UsbDiscovery`, `BluetoothDiscovery`, `ScheduledExecutorService timerExecutor`.
- **Hàm:** `create(address)` chỉ điều phối theo `TransportType`, mỗi loại 1 hàm riêng:
  - `createUsb` → `usbDiscovery.find(address)` → `new UsbTransport(usbManager, device)`.
  - `createBluetooth` → `bluetoothDiscovery.findBonded(address.mac())` → `new BluetoothTransport(device, timer)`.
  - `createLan` → `new LanTransport(address.host(), address.port(), timer)`.
- **Không làm:** mở transport (việc của `ConnectionPool`).

#### `StreamWriter`

- **Nhiệm vụ:** ghi vào một `OutputStream` theo khúc, đúng hạn, đếm được số byte đã gửi — dùng chung cho Bluetooth và
  LAN (hai loại stream không có timeout ghi). Java thuần, test JUnit với stream giả.
- **Hàm:** `static void writeAll(OutputStream stream, Closeable connection, byte[] data, long deadlineNanos,
  ScheduledExecutorService timer) throws DeviceException`.
- **Quy tắc:**
  - Ghi từng khúc `STREAM_CHUNK_SIZE_BYTES` = 4 096 rồi `flush`; cộng số byte sau mỗi khúc `flush` xong. Số này là
    "đã giao cho hệ điều hành", không phải "máy in đã nhận" — vì vậy có thể thiếu so với thực tế, không bao giờ thừa.
  - Hẹn giờ tại hạn: nếu lúc đó vẫn đang ghi thì đóng `connection` để cắt lần ghi đang kẹt.
  - Dùng một cờ atomic giữa "ghi xong" và "hẹn giờ nổ": ghi xong trước → huỷ hẹn, không bao giờ báo hết hạn giả;
    hẹn giờ nổ trước → `WRITE_TIMEOUT` kèm số byte của các khúc đã ghi xong.
  - Lỗi I/O không do hẹn giờ → `WRITE_FAILED` kèm số byte đã ghi.

#### `UsbTransport`

- **Nhiệm vụ:** truyền byte qua USB.
- **`open`:** `openDevice` + `claimInterface(force = true)` trên interface có bulk OUT; giữ bulk IN nếu có; đọc serial;
  lỗi → `CONNECTION_FAILED`.
- **`write`:** chia khúc tối đa `USB_CHUNK_SIZE_BYTES` = 16 384, `bulkTransfer(endpoint, buffer, offset, length,
  timeout)` với timeout = thời gian còn lại; lặp tới đủ; trả < 0 → `WRITE_TIMEOUT` nếu đã hết hạn, ngược lại
  `WRITE_FAILED`. Vòng chia khúc là hàm static nhận một "người ghi khúc" để test JUnit.
- **`read`:** không có bulk IN → `READ_NOT_SUPPORTED`; có → `bulkTransfer` IN với thời gian còn lại, trả số byte nhận
  được.
- **`isOpen`:** đã claim và thiết bị còn trong `usbManager.getDeviceList()`.
- **`abort`:** `releaseInterface` + `close` (đồng bộ hoá để gọi được từ luồng khác lúc đang `bulkTransfer`).
- **`close`:** gọi `abort()` — `bulkTransfer` trả về khi dữ liệu đã giao xong nên không có gì cần chờ.
- **`hardwareAddress`:** `UsbDevice.getDeviceName()` (vd `/dev/bus/usb/001/004`; khác nhau giữa 2 máy cùng model).

#### `BluetoothTransport`

- **Nhiệm vụ:** truyền byte qua Bluetooth cổ điển (RFCOMM).
- **`open`:** socket RFCOMM theo SPP UUID, lỗi thì thử lại 1 lần; vẫn lỗi → `CONNECTION_FAILED`.
- **`write`:** `StreamWriter.writeAll(outputStream, socket, …)`.
- **`read`:** `BluetoothSocket` không có timeout đọc → hỏi `available()` theo chu kỳ `READ_POLL_INTERVAL_MS` tới hạn;
  có byte → đọc tối đa `maxBytes` và trả ngay.
- **`close`:** chờ dữ liệu cuối kịp gửi rồi `abort()`. `flush` không bảo đảm máy in đã nhận; một số máy in Bluetooth
  rẻ mất phần cuối nếu socket đóng ngay. Thời gian chờ ước theo số byte lần ghi gần nhất (`DRAIN_MIN_WAIT_MS` = 100
  cho lần ghi ≤ `DRAIN_SMALL_PAYLOAD_BYTES` = 2 000, không thì số byte / `DRAIN_BYTES_PER_MS` = 5). Kiểm tra trên
  máy thật xem việc chờ còn cần không (§14, mục 12); không cần thì bỏ.
- **`abort`:** đóng socket ngay.
- **`hardwareAddress`:** MAC viết hoa.

#### `LanTransport`

- **Nhiệm vụ:** truyền byte qua TCP.
- **`open`:** `Socket.connect` timeout `LAN_CONNECT_TIMEOUT_MS` = 5 000; lỗi → `CONNECTION_FAILED`.
- **`write`:** `StreamWriter.writeAll(outputStream, socket, …)` (rút dây mạng thường không làm socket báo lỗi ngay).
- **`read`:** `setSoTimeout(thời gian còn lại)`; đọc một lần tối đa `maxBytes`; `SocketTimeoutException` khi chưa có
  byte → mảng rỗng. Peer đóng (`read` trả -1) → `abort()` rồi `READ_FAILED`.
- **`close`:** gọi `abort()` (đóng socket).
- **`hardwareAddress`:** `host:port`.
- **Giới hạn:** TCP không tự biết máy in đã tắt/rút dây khi kết nối đang rảnh. Native chỉ phát hiện khi một lần
  ghi/đọc lỗi hoặc hết hạn (hoặc hệ điều hành báo socket hỏng); không có heartbeat. Nhờ vậy `isAlive()` có thể còn
  `true` với kết nối LAN đã chết; lần `write` sau sẽ lỗi và báo mất kết nối.

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
  readonly devicePath: string | null;
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
  readonly deviceId: string;
  readonly name: string | null;
  readonly address: NativeUsbAddress;
  readonly manufacturerName: string | null;
  readonly productName: string | null;
  readonly hasPermission: boolean;
}

interface NativeBluetoothDeviceInfo {
  readonly type: 'bluetooth';
  readonly deviceId: string;
  readonly name: string | null;
  readonly address: NativeBluetoothAddress;
}

type NativeDeviceInfo = NativeUsbDeviceInfo | NativeBluetoothDeviceInfo;

interface NativeConnectedDevice {
  readonly connectionId: string;
  readonly serialNumber: string | null;
}

type DisconnectReason = 'usb_detached' | 'bluetooth_disconnected' | 'io_error';

interface DeviceDisconnectedEvent {
  readonly connectionId: string;
  readonly reason: DisconnectReason;
}
```

| Hàm | Tham số | Kết quả | Ghi chú |
|---|---|---|---|
| `discover(type)` | `'usb'` \| `'bluetooth'` | `NativeDeviceInfo[]` | Không mở hộp thoại quyền |
| `connect(address)` | `NativeDeviceAddress` | `NativeConnectedDevice` | Thiết bị đang mở → trả kết nối đó |
| `write(connectionId, base64Data, timeoutMs)` | | `void` | Ghi đủ trong `timeoutMs`, không thì reject |
| `read(connectionId, maxBytes, timeoutMs)` | | base64 \| `null` | §9.4 |
| `disconnect(connectionId)` | | `void` | Chưa kết nối vẫn resolve |
| Sự kiện `DeviceDisconnected` | | `DeviceDisconnectedEvent` | Chỉ khi mất ngoài ý muốn, không khi JS gọi `disconnect` |

Kiểu ở cầu nối mang tiền tố `Native` để phân biệt với kiểu nghiệp vụ cùng nghĩa bên TS (`PrinterConnection`,
`PrinterConnectTarget`). `connectionId` là mã mờ — TS không phân tích, không lưu vào storage.

## 9. Quy tắc chi tiết

### 9.1 `connectionId`

`connectionId` = loại + `:` + địa chỉ phần cứng của thiết bị đã tìm ra:

| Loại | `connectionId` |
|---|---|
| USB | `usb:/dev/bus/usb/001/004` (đường dẫn thiết bị, đổi khi cắm lại) |
| Bluetooth | `bluetooth:66:22:A1:B2:C3:D4` (MAC viết hoa) |
| LAN | `lan:192.168.1.50:9100` |

Vì xác định từ thiết bị thật, mọi địa chỉ cùng trỏ tới một máy cho cùng `connectionId`. Id chỉ có ý nghĩa trong phiên
kết nối; máy in đã lưu nhận diện bằng `identityKey` của TS.

### 9.2 Chọn thiết bị USB khi kết nối

1. Lấy các thiết bị đang cắm cùng vendorId + productId và có endpoint bulk OUT. Không có → `DEVICE_NOT_FOUND`.
2. Địa chỉ **có serial**: duyệt ứng viên, thiết bị đã có quyền trước; thiết bị chưa có quyền thì xin quyền rồi đọc
   serial. Khớp → dùng; không ứng viên nào khớp → `DEVICE_NOT_FOUND` (không lùi về `devicePath`).
3. Địa chỉ **không serial, có `devicePath`** và đường dẫn đó nằm trong danh sách ứng viên → dùng thiết bị đó.
4. Còn lại: đúng 1 ứng viên → dùng; nhiều hơn → `AMBIGUOUS_DEVICE`. **Không bao giờ âm thầm chọn máy đầu tiên.**
5. Thiết bị được chọn chưa có quyền → `UsbPermission.request`.

**Giới hạn đã chấp nhận:** Android chỉ cho đọc serial sau khi có quyền. Địa chỉ có serial mà có nhiều máy cùng model
chưa được cấp quyền → người dùng có thể thấy lần lượt nhiều hộp thoại quyền (mỗi hộp thoại chờ tối đa 30s); từ chối
một hộp thoại → `PERMISSION_DENIED` cho cả lần `connect`. Trường hợp này hiếm (chỉ khi cắm lại nhiều máy cùng model)
và mỗi máy chỉ hỏi một lần, vì Android nhớ quyền tới khi rút dây.

### 9.3 Xếp hàng, mất kết nối và chen ngang

| # | Tình huống | Hành vi | Nơi xử lý |
|---|---|---|---|
| 1 | Nhiều `write`/`read` liên tiếp trên một kết nối | Chạy đúng thứ tự gọi; hạn của mỗi thao tác tính lúc nó bắt đầu chạy | `Connection` |
| 2 | Hai `connect` đồng thời cùng địa chỉ | Gộp theo `lookupKey`: tìm/mở một lần, cả hai nhận cùng kết quả | `ConnectionPool` |
| 3 | Hai `connect` đồng thời, địa chỉ khác nhau nhưng cùng thiết bị | Gộp theo `connectionId` sau khi tìm ra thiết bị: giữ chỗ trong khoá, chỉ một bên mở transport; bên kia chờ rồi dùng lại, `abort()` transport chưa mở của mình | `ConnectionPool` |
| 4 | `connect` khi thiết bị đang mở và còn sống | Trả ngay kết nối đó | `ConnectionPool` |
| 5 | `connect` khi thiết bị đang mở nhưng đã chết | Bỏ kết nối cũ (abort, không phát sự kiện), mở mới | `ConnectionPool` |
| 6 | `connect` khi thiết bị đang đóng (`disconnect` chưa xong) | Chờ đóng xong rồi mới mở — không bao giờ mở 2 transport cùng thiết bị | `ConnectionPool` |
| 7 | `disconnect` khi đang ghi, hoặc `write` gọi sát `disconnect` trên luồng khác | `Entry` chuyển `CLOSING` ngay trong khoá (thao tác gọi sau → `NOT_CONNECTED`); thao tác đã xếp trước chạy xong (tối đa tới hạn) rồi mới đóng. Mỗi `write` hoặc chạy trước lệnh đóng, hoặc nhận `NOT_CONNECTED` — không bao giờ chạy sau khi transport đóng | `ConnectionPool` + `Connection.close` |
| 8 | `disconnect` khi `connect` đang mở dở cùng thiết bị | Chờ mở xong rồi đóng; `connect` vẫn resolve | `ConnectionPool` |
| 9 | `disconnect` với `connectionId` chưa mở | Resolve ngay | `ConnectionPool` |
| 10 | Rút USB / mất Bluetooth khi đang ghi | `loseConnection`: bỏ khỏi pool, phát `DeviceDisconnected` 1 lần, `abort()`; thao tác đang chạy và đang chờ → `CONNECTION_LOST` (kèm `bytesWritten`) | Monitor → `ConnectionPool` → `Connection` |
| 11 | Lỗi ghi tới trước broadcast rút USB | `transport.isOpen()` false → mất kết nối `IO_ERROR` (bỏ khỏi pool trước), rồi thao tác đó trả mã gốc (`WRITE_FAILED`); broadcast tới sau bị bỏ qua — sự kiện phát đúng 1 lần, lý do của tín hiệu tới trước | `Connection` + `ConnectionPool` |
| 12 | Mất mạng LAN / ra khỏi tầm Bluetooth khi đang ghi | Socket không báo lỗi → hẹn giờ đóng socket tại hạn → `WRITE_TIMEOUT`; hệ điều hành báo lỗi trước hạn → `WRITE_FAILED`. Cả hai kèm byte đã gửi; transport đã đóng → mất kết nối `IO_ERROR`, phát sự kiện **đúng một lần** | `StreamWriter` + `Connection` + `ConnectionPool` |
| 13 | Ghi xong đúng lúc hẹn giờ nổ | Cờ atomic: bên nào đặt trước thắng; ghi xong trước → thành công, không đóng socket | `StreamWriter` |
| 14 | Hẹn giờ nổ cùng lúc `abort()` | `abort()` thắng; thao tác → `CONNECTION_LOST` | `Connection` |
| 15 | USB hết hạn khi ghi, thiết bị vẫn cắm | `WRITE_TIMEOUT` kèm byte đã ghi; giữ kết nối | `UsbTransport` + `Connection` |
| 16 | `close()` và `abort()` cùng lúc | `abort()` thắng; future `close()` hoàn tất thành công | `Connection` |
| 17 | Rút dây trong lúc `disconnect` đang chờ | Không phát sự kiện (JS đã chủ động đóng); đóng tiếp bình thường | `ConnectionPool` |
| 18 | Rút dây khi hộp thoại quyền USB đang mở | `PERMISSION_DENIED` | `UsbPermission` |
| 19 | Rút dây khi đang `open` | `CONNECTION_FAILED` | Transport |
| 20 | `closeAll()` khi có kết nối đang mở / đang đóng | Abort tất cả (không chờ), thao tác chưa xong → `CONNECTION_LOST`, không phát sự kiện | `ConnectionPool` |
| 21 | `closeAll()` khi `connect` đang chờ quyền USB hoặc transport đã mở nhưng chưa vào pool | `shutdownNow()` ngắt luồng mở kết nối: lần chờ quyền dừng ngay, huỷ receiver. Trước khi đưa vào pool luôn kiểm tra `closed` trong khoá: đã đóng → `abort()` transport. Mọi `connect` dở reject `SERVICE_CLOSED`; không bao giờ thêm kết nối sau khi pool đóng | `ConnectionPool` + `UsbPermission` |
| 22 | `closeAll()` khi `discover` đang chạy | Lần quét chạy xong và resolve; lời gọi sau → `SERVICE_CLOSED` | `DeviceService` |
| 23 | Mọi lời gọi sau `close()` | `SERVICE_CLOSED`; không Future/Promise nào treo | `DeviceService` + `ConnectionPool` |

### 9.4 Ngữ nghĩa `read`

- Trả **ngay khi có ít nhất 1 byte**, tối đa `maxBytes` (giới hạn, không phải số byte bắt buộc).
- Hết hạn mà chưa có byte → native trả mảng rỗng, JS nhận `null`.
- Cả USB, Bluetooth, LAN làm giống nhau. Native không biết giao thức nên không biết phản hồi đã đủ chưa; TS gọi `read`
  lặp lại và tự gom cho tới khi đủ theo giao thức (ví dụ phản hồi TSPL `~!T` kết thúc bằng ký tự xuống dòng).

## 10. Mã lỗi (`DeviceErrorCode`)

Reject bằng `promise.reject(code, message)`; `WRITE_*` và `CONNECTION_LOST` khi đang ghi thêm
`userInfo.bytesWritten`.

| Mã | Khi nào |
|---|---|
| `INVALID_ARGUMENT` | Địa chỉ/base64 sai; `timeoutMs` ngoài 1..600 000; `maxBytes` ngoài 1..65 536; `discover('lan')` |
| `DEVICE_NOT_FOUND` | Không thấy thiết bị khớp địa chỉ |
| `AMBIGUOUS_DEVICE` | Nhiều USB cùng vendorId/productId mà địa chỉ không có serial và `devicePath` không khớp |
| `PERMISSION_DENIED` | Từ chối/hết giờ hộp thoại quyền USB; thiếu quyền Bluetooth |
| `BLUETOOTH_DISABLED` | Bluetooth tắt hoặc máy không có Bluetooth |
| `CONNECTION_FAILED` | Mở kết nối thất bại |
| `NOT_CONNECTED` | `write`/`read` với `connectionId` chưa mở hoặc đã `disconnect` |
| `CONNECTION_LOST` | Kết nối mất (hoặc bị abort do `closeAll`) khi thao tác đang chạy/chờ |
| `WRITE_FAILED` | Lỗi I/O khi ghi |
| `WRITE_TIMEOUT` | Hết hạn khi chưa ghi đủ |
| `READ_NOT_SUPPORTED` | USB không có endpoint bulk IN |
| `READ_FAILED` | Lỗi I/O khi đọc |
| `SERVICE_CLOSED` | Lời gọi sau khi `DeviceService` đã đóng (JS reload); `connect` đang dở lúc đóng |

Ngoài 13 mã trên, bridge có thêm `INTERNAL_ERROR` (không thuộc `DeviceErrorCode`): exception không phải
`CodedException` (lỗi lập trình) → `DeviceModule` reject `INTERNAL_ERROR` và log.
TS ánh xạ mã sang `PrinterErrorCode` trong `NativeAdapter`.

### Luồng chạy

| Luồng | Tạo ở | Chạy gì | Ai tắt |
|---|---|---|---|
| Luồng của native module | React Native | `DeviceModule` nhận lời gọi, gắn callback, trả về ngay | React Native |
| Luồng quét (1) | `DeviceFactory` → `DeviceService` | `discover` | `DeviceService.close` (`shutdown`) |
| Luồng mở kết nối (nhiều) | `DeviceFactory` → `ConnectionPool` | `TransportFactory.create` + `open` (chờ quyền USB tới 30s, socket tới 5s) | `ConnectionPool.closeAll` (`shutdownNow`) |
| Luồng riêng của mỗi `Connection` | `ConnectionPool` (qua `operationExecutorFactory`) | `write`, `read`, `close` theo đúng thứ tự gọi | `Connection.close`/`abort` |
| Luồng đóng khẩn (1) | `DeviceFactory` → `ConnectionPool` | `abort()` kết nối bị mất / đã chết | `ConnectionPool.closeAll` (`shutdown`) |
| Luồng hẹn giờ ghi (1, scheduled) | `DeviceFactory` → `TransportFactory` → Bluetooth/LAN transport | Đóng socket khi lần ghi quá hạn | `DeviceService.close`, sau `closeAll` |
| Luồng UI | Android | Broadcast của monitor, chỉ gọi `onHardwareLost` | Android |

Executor truyền qua constructor để test chạy đồng bộ.

### Ví dụ: thêm máy in USB rồi in 1 bill

```text
JS discover('usb')
  → [{ deviceId: "usb:/dev/bus/usb/001/004", name: "XP-80C",
       address: { type: 'usb', vendorId: 8137, productId: 8214, serialNumber: null,
                  devicePath: "/dev/bus/usb/001/004" }, hasPermission: false }]

JS connect(device.address)
  DeviceModule → DeviceMapper.toAddress → DeviceService.connect → ConnectionPool.connect
  → luồng mở kết nối: TransportFactory.create → UsbDiscovery.find (khớp devicePath, xin quyền) → new UsbTransport
  → connectionId "usb:/dev/bus/usb/001/004" → open (đọc serial) → new Connection
  → resolve { connectionId: "usb:/dev/bus/usb/001/004", serialNumber: "SN123" }
  TS lưu máy in với serial "SN123" → identityKey "usb:8137:8214:SN123"

JS write("usb:/dev/bus/usb/001/004", base64Bill, 10000)
  → ConnectionPool.write → Connection.write (xếp hàng) → tới lượt: hạn = bây giờ + 10s
  → UsbTransport.write (chia khúc 16 KB) → resolve

Rút dây USB
  → UsbDetachMonitor → ConnectionPool.onHardwareLost("/dev/bus/usb/001/004", USB_DETACHED)
  → loseConnection: bỏ khỏi pool → IDisconnectListener → DeviceModule phát DeviceDisconnected
  → luồng đóng khẩn: Connection.abort() → thao tác đang chờ reject CONNECTION_LOST

Cắm lại, lần sau in: TS connect({ type: 'usb', vendorId: 8137, productId: 8214, serialNumber: "SN123",
  devicePath: null }) → khớp serial → connectionId mới "usb:/dev/bus/usb/001/005"
```

## 11. Thay đổi phía TS (tối thiểu để app chạy với API mới)

- `adapters/native/PrinterNativeModule.ts` → `adapters/native/DeviceModule.ts`: kiểu và hàm theo §8;
  `subscribeDeviceDisconnected(callback: (event: DeviceDisconnectedEvent) => void)`.
- `adapters/native/NativeConnectionPool.ts` (mới) — nơi duy nhất đếm số người dùng một kết nối native:
  - `acquire(address): Promise<NativeConnectionLease>`; lease có `connectionId`, `serialNumber` và `release()` chỉ có
    tác dụng ở lần gọi đầu.
  - Đếm theo `connectionId` native trả về (hai địa chỉ khác nhau cùng thiết bị dùng chung bộ đếm).
  - Các `acquire` chạy **song song**: máy này đang chờ hộp thoại quyền USB không chặn `acquire` máy khác. Mọi thay
    đổi bộ đếm là đồng bộ (không có `await` ở giữa); chỉ lệnh native được chờ.
  - Bộ đếm về 0 → xoá bộ đếm, ghi `closingByConnectionId[connectionId]` = promise của native `disconnect`, chờ xong
    thì xoá. `acquire` thất bại → không tăng bộ đếm.
  - `acquire` nhận về `connectionId` đang có trong `closingByConnectionId` (native trả kết nối sắp bị đóng cho một
    `connect` gửi đi trước lệnh `disconnect`) → chờ đóng xong rồi `connect` lại; chỉ tăng bộ đếm khi id nhận được
    không đang đóng. Kiểm tra "đang đóng" và tăng bộ đếm nằm trong cùng một bước đồng bộ, nên không bao giờ trao cho
    nơi gọi một kết nối đang bị đóng.
  - Nhận `DeviceDisconnected` → xoá bộ đếm của `connectionId` đó (các lease cũ `release()` thành không làm gì).
- `adapters/native/NativeAdapter.ts`: dùng `NativeConnectionPool`; lưu lease; `canRead = true`; `read()` gọi native và
  gom theo nhu cầu của driver; `getConnectionIdentity()` → `getConnectionId()`; ánh xạ mã lỗi §10; `listDevices` dùng
  `deviceId` và giữ `address` trong `rawDevice`.
- `adapters/IPrinterAdapter.ts`: `PrinterConnectTarget.usb` thêm `serialNumber`, `devicePath`; `toConnectTarget`
  truyền serial.
- Luồng thêm máy in (`hooks/addPrinter/useConnectionSetup.ts`, `discovery/PrinterResolver.ts`): sau khi `connect`
  thành công, nếu `serialNumber` trả về khác `null` mà bản nháp chưa có serial thì cập nhật serial vào kết nối USB của
  bản nháp trước khi lưu.
- `discovery/PrinterResolver.resolveIdentityKey`: MAC Bluetooth viết hoa (dữ liệu đã lưu vốn viết hoa từ Android nên
  không cần chuyển đổi).
- Xoá `transports/UsbTransport.ts` và test của nó (native đã chia khúc).
- Đổi theo tên mới: `EscPosDriver`, `TsplDriver`, `adapters/resolvePrinterAdapter.ts`,
  `connection/PrinterConnectionLock.ts`, `adapters/testing/MockPrinterAdapter.ts` và các test liên quan;
  `jest.setup.js` mock `NativeModules.DeviceModule`.
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
7. **1 hàm 1 trách nhiệm**; nhánh theo `TransportType` chỉ điều phối, mỗi loại gọi 1 hàm riêng.
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

    /** Mã của kết nối, xác định từ thiết bị vật lý nên mọi địa chỉ trỏ tới cùng máy cho cùng mã. */
    private final String connectionId;

    private final ITransport transport;

    /** Một luồng duy nhất: ghi/đọc/đóng của cùng kết nối không bao giờ chạy song song. */
    private final ExecutorService operationExecutor;

    /** Báo pool khi transport không còn dùng được sau một lỗi. */
    private final Consumer<Connection> transportLostHandler;

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

  /** Định danh trong lần cắm hiện tại, dùng làm key danh sách; đổi khi rút ra cắm lại. */
  readonly deviceId: string;

  /** Địa chỉ truyền lại nguyên vẹn khi `connect`. */
  readonly address: NativeUsbAddress;

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
    ├── DeviceServiceTest.java           # chọn discovery theo loại; LAN → INVALID_ARGUMENT; close gọi nhiều lần;
    │                                    # sau close → SERVICE_CLOSED; discover đang chạy vẫn xong
    ├── model/DeviceAddressTest.java     # kiểm tra tham số; MAC viết hoa; lookupKey
    ├── discovery/UsbDiscoveryTest.java  # chooseCandidate: không có; serial khớp/không; devicePath khớp/không;
    │                                    # một ứng viên; nhiều ứng viên → AMBIGUOUS_DEVICE
    ├── connection/
    │   ├── FakeTransport.java           # ITransport giả: điều khiển được ghi chậm, lỗi, hết hạn, isOpen
    │   ├── FakeTransportFactory.java    # factory giả: chặn được lúc tạo (giả lập chờ quyền USB)
    │   ├── Futures.java                 # chờ future/latch có giới hạn thời gian trong test
    │   ├── ConnectionTest.java
    │   └── ConnectionPoolTest.java
    └── transport/
        ├── StreamWriterTest.java        # chia khúc 4 KB; đếm byte; hẹn giờ nổ → WRITE_TIMEOUT kèm byte đã gửi;
        │                                # ghi xong đúng lúc hẹn giờ → không báo hết hạn giả
        └── UsbTransportTest.java        # chia khúc 40 KB → 16/16/8; hết hạn → WRITE_TIMEOUT kèm byte đã ghi
```

`ConnectionTest`, `ConnectionPoolTest`, `StreamWriterTest`, `DeviceServiceTest` phủ đủ 23 tình huống ở §9.3 (trừ #18,
#19 cần thiết bị thật), mỗi tình huống ít nhất một test. Bắt buộc có thêm:

- `ConnectionTest`: `close()` gọi `transport.close()` (không `abort`); `abort()` gọi `transport.abort()` (không
  `close`); hạn truyền xuống là `System.nanoTime()` lúc thao tác bắt đầu + timeout.
- `ConnectionPoolTest`:
  - `closeAll` trong lúc `connect` đang chờ quyền (factory giả chặn tới khi bị ngắt) → `connect` reject
    `SERVICE_CLOSED` trong vòng 2 giây, không transport nào được tạo.
  - `write` và `disconnect` chen nhau thật trên nhiều luồng (100 vòng × 20 lần ghi): mỗi lần ghi hoặc thành công,
    hoặc `NOT_CONNECTED`; không lần ghi nào tới transport sau khi transport đã đóng.
  - Hai địa chỉ khác nhau cùng thiết bị: transport thừa bị `abort()`, không bao giờ `open()`.

`bridge/` không có unit test (chỉ đổi kiểu và gọi xuống); kiểm qua Jest phía TS và máy thật.

**Jest** (TS):

- `NativeConnectionPool`: hai `acquire` cùng thiết bị dùng chung kết nối; `release` lặp lại chỉ trừ 1 lần; về 0 thì
  `disconnect`; `acquire` nhận đúng kết nối đang bị `release` đóng thì chờ đóng xong rồi kết nối lại; một máy đang
  chờ `connect` không chặn `acquire` máy khác; `acquire` lỗi không tăng bộ đếm; `DeviceDisconnected` xoá bộ đếm.
- `NativeAdapter`: ánh xạ mã lỗi, `read`, truyền serial/`devicePath`.
- Luồng thêm máy in: serial trả về từ `connect` được lưu vào bản nháp.

**Kiểm tra trên máy thật** (bắt buộc):

1. USB: hộp thoại quyền — đồng ý, từ chối, rút dây khi hộp thoại đang mở.
2. USB: thêm máy chưa có quyền → sau khi kết nối, máy in đã lưu có serial (nếu máy in có serial).
3. USB: in bill ESC/POS và tem TSPL có ảnh lớn hơn 16 KB.
4. USB: rút dây lúc rảnh và lúc đang in → app nhận mất kết nối đúng một lần; cắm lại kết nối được.
5. USB: 2 máy cùng model (nếu có) → in đúng máy; rút một máy không ảnh hưởng máy kia.
6. TSPL qua USB: `read` nhận phản hồi lệnh dò (nếu máy có endpoint IN).
7. Bluetooth: kết nối, in; tắt máy in hoặc ra khỏi tầm sóng (lúc rảnh và lúc đang in) → app nhận
   `DeviceDisconnected` đúng một lần (lý do `bluetooth_disconnected` hoặc `io_error`, tuỳ tín hiệu nào tới trước);
   lệnh in đang chạy reject `CONNECTION_LOST`, `WRITE_TIMEOUT` hoặc `WRITE_FAILED`; tắt Bluetooth của điện thoại →
   `BLUETOOTH_DISABLED`.
8. LAN: kết nối, in; IP sai → `CONNECTION_FAILED` sau khoảng 5s; rút dây mạng khi đang in → `WRITE_TIMEOUT` hoặc
   `WRITE_FAILED`, rồi `DeviceDisconnected` đúng một lần; app không treo.
9. Đang in một máy thì kết nối/in máy khác → không phải chờ.
10. Bấm ngắt kết nối khi đang in → lệnh in đang chạy hoàn tất (hoặc hết hạn) rồi mới đóng; không có sự kiện mất kết nối.
11. Reload JS nhiều lần, kể cả khi đang in hoặc đang mở hộp thoại quyền USB → không rò kết nối (kết nối lại được ngay).
12. Bluetooth, chờ trước khi đóng: in bill ngắn rồi ngắt kết nối ngay, lặp 10 lần trên từng máy in Bluetooth đang có;
    sau đó tạm đặt thời gian chờ về 0 và lặp lại. Bản in đủ cả khi không chờ → bỏ phần chờ trong
    `BluetoothTransport.close()` (khi đó `close()` gọi thẳng `abort()`); mất phần cuối → giữ.

## 15. Thứ tự triển khai

1. Model, lỗi, `common/` + test (`DeviceAddress`, `CodedException`).
2. `Connection` → `ConnectionPool` với transport giả; test đủ các tình huống §9.3.
3. `StreamWriter` + transport: USB trước, rồi Bluetooth và LAN; discovery, permission, monitor.
4. `DeviceService`, `DeviceFactory`, bridge (`DeviceModule`, `DeviceMapper`, `NdtCorePosPackage`).
5. TS: `DeviceModule.ts`, `NativeConnectionPool`, `NativeAdapter`, luồng thêm máy in; xoá `thermalprinter/`.
6. Kiểm tra trên máy thật.

## 16. Tiêu chí hoàn thành

- Cấu trúc và tên đúng §5–§7; `com/ndtcorepos/thermalprinter/` đã xoá.
- API JS đúng §8; native không còn `printerId`.
- 23 tình huống §9.3 có test (JUnit hoặc kiểm tra trên máy thật).
- `grep` `thermalprinter`, `ThermalPrinterModule`, `getConnectionIdentity` trong code và tài liệu đang dùng ra rỗng
  (trừ spec/plan cũ).
- 11 hành vi trong bảng §4 đều có test tự động hoặc mục kiểm tra trên máy thật.
- `./gradlew :app:testDebugUnitTest` xanh; `npm run verify` xanh.
- Danh sách kiểm tra trên máy thật đã chạy, kết quả ghi trong PR.

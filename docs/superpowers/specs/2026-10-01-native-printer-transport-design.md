# Tầng native máy in: chỉ nhận kết nối, gọn theo transport — Design Spec

## Mục tiêu

Tầng native (Java, Android) chỉ làm "đường ống": liệt kê thiết bị, mở kết nối, ghi byte, đọc byte, đóng kết nối, báo
mất kết nối. Native **chỉ nhận thông tin kết nối** và trả về `connectionId`; không biết `printerId`, máy in đã lưu, giao
thức, khổ giấy hay loại bản in.

Đồng thời:

- gom 37 file hiện tại (chia theo vai trò `connection/`, `writer/`, `device/`, `discovery/`, `identity/`,
  `permission/`, `queue/`) thành 29 file chia theo loại kết nối, mỗi file 1 khái niệm (§6);
- đặt lại tên package, module, class, sự kiện cho đúng trách nhiệm (§0);
- sửa các lỗi thật tìm thấy khi review.

## Nguyên tắc đã chốt

- **Native chỉ nhận connection.** Không có `printerId` ở native. `connectionId` suy ra từ thông tin kết nối mà TS
  truyền vào, nên cùng thông tin luôn ra cùng `connectionId`.
- **Một kết nối vật lý = một `ActiveConnection`.** Native không biết hai kết nối (USB và LAN) có phải cùng một máy hay
  không. "Một máy in nhiều đường kết nối" là quyết định nghiệp vụ của TS.
- **Dùng chung kết nối do TS quản lý.** Hai máy in đã lưu trỏ cùng một kết nối thì TS đếm số người dùng và chỉ gọi
  `disconnect` khi không còn ai. Native: `connect` lại cùng thông tin trả về kết nối đang mở; `disconnect` đóng ngay.
- **Native không hiển thị UI.** Bỏ các `Toast` tiếng Anh hiện có; mọi thông báo cho người dùng do TS hiển thị.
- **Không chặn luồng bridge.** Mọi thao tác chậm (xin quyền USB, mở socket, ghi, đọc, đóng) chạy trên luồng riêng;
  Promise được resolve/reject từ luồng đó.

## Ngoài phạm vi

- Gộp `adapters/` + `transports/` bên TS, bỏ `LibraryAdapter`, chuyển TSPL Bluetooth/LAN sang native (làm ở spec tái
  cấu trúc tầng TS máy in, sau khi native có `read`).
- Thu hẹp `connectionResourceKey` của `PrintScheduler` (hiện USB dùng chung khoá `'usb'`, ESC/POS theo loại kết nối).
  Native mới cho phép song song theo `connectionId`, nhưng đổi lịch in thuộc spec TS.
- Đổi tên phần TS ngoài các file liệt kê ở §7 (`IPrinterAdapter`, `PrinterConnectTarget`, model `PrinterConnection`…).
- Quét máy in LAN; lọc thiết bị Bluetooth theo loại (hiện trả mọi thiết bị đã ghép đôi, giữ nguyên).
- iOS (`printTextLegacyIOS` giữ nguyên).
- Model "một máy in nhiều đường kết nối" bên TS.

## Lỗi hiện tại được sửa

| # | Lỗi | Sửa |
|---|---|---|
| 1 | `connect` USB chỉ tìm theo vendorId/productId, bỏ qua serial → 2 máy cùng model luôn lấy máy đầu | Khớp serial (§2.3) |
| 2 | Sự kiện rút USB khớp theo `vid:pid` → rút 1 máy, máy cùng model cũng bị coi là mất | Khớp theo `UsbDevice.getDeviceName()` |
| 3 | Rút USB xử lý 2 lần: `UsbConnection` tự đóng và `UsbConnectionWatcher` dọn dẹp, không phối hợp | Một đường qua `ConnectionManager` |
| 4 | `writeByBase64` chặn bridge tới 15s; `connect` chặn tới 30s khi chờ hộp thoại quyền USB | Chạy trên luồng riêng (§4) |
| 5 | USB ghi cả payload bằng 1 lần `bulkTransfer`; ghi thiếu byte vẫn báo thành công | Chia khúc, ghi đủ mới thành công (§3.1) |
| 6 | `timeout` của writer Bluetooth/LAN bị bỏ qua; 2 mức timeout chồng nhau (5s, 15s) | Một deadline cho cả lần ghi do TS truyền |
| 7 | Native không đọc được (`read` luôn `null`) → TSPL phải đi `LibraryAdapter` | Thêm `read` (§1) |
| 8 | Receiver đăng ký `RECEIVER_EXPORTED` cho cả action quyền USB nội bộ | `RECEIVER_NOT_EXPORTED` |
| 9 | `Toast` tiếng Anh hiển thị từ native | Bỏ |
| 10 | `PrinterWriteResult` dùng cho cả `open`/`close` | Lỗi ném `ConnectionException`, thành công không trả gì |

## Thiết kế

### 0. Từ vựng và tên

#### 0.1 Từ vựng

| Từ | Nghĩa | Không dùng |
|---|---|---|
| **target** | Thông tin để kết nối: USB vid/pid/serial, địa chỉ Bluetooth, host/port LAN. Đầu vào từ TS | "device", "request" |
| **connectionId** | Chuỗi định danh một kết nối, suy ra từ target (§2) | "identity", "identityKey" (ở native) |
| **active connection** | Một kết nối đang mở: transport + hàng đợi thao tác tuần tự | "session", "device", "runtime" |
| **transport** | Đọc/ghi byte thô trên một loại đường truyền (USB, Bluetooth, LAN) | "writer", "connection" |
| **discovered device** | Một thiết bị `listDevices` tìm thấy, chưa kết nối | "printer", "descriptor" |

Tầng native và kiểu ở cầu nối chỉ dùng hai danh từ **Device** và **Connection**, không dùng "Printer": native chỉ
thấy thiết bị USB/Bluetooth/LAN và không biết thiết bị đó có phải máy in (danh sách Bluetooth trả cả tai nghe). Chữ
"Printer" chỉ bắt đầu từ tầng nghiệp vụ TS (`PrinterService`, driver, model `Printer`).

#### 0.2 Đổi tên phía native (Java)

| Hiện tại | Mới | Lý do |
|---|---|---|
| package `com.ndtcorepos.thermalprinter` | `com.ndtcorepos.deviceconnection` | Tầng này chỉ lo kết nối tới thiết bị; "thermal printer" không đúng trách nhiệm |
| module RN `ThermalPrinterModule` | `DeviceConnectionModule` | Như trên |
| `ThermalPrinterPackage` | `DeviceConnectionPackage` | Như trên |
| sự kiện `ThermalPrinterConnectionLost` | `DeviceConnectionLost` | Như trên |
| `PrinterDeviceManager` + `PrinterDeviceRegistry` + `PrinterQueueManager` | `ConnectionManager` | Một nơi mở/dùng lại/đóng/xử lý mất kết nối |
| `IPrinterDevice` + `*PrinterDevice` + `PrinterQueue` | `ActiveConnection` | Một kết nối đang mở + hàng đợi của nó |
| `IPrinterConnection` + `IPrinterWriter` + `*Connection` + `*Writer` | `ITransport` + `UsbTransport`/`BluetoothTransport`/`LanTransport` | Mở/ghi/đọc/đóng là một khối, không tách đôi |
| `ConnectionIdentity` + `IConnectionIdentityResolver` + `UsbConnectionIdentityResolver` | `IConnectionTarget` + `UsbTarget`/`BluetoothTarget`/`LanTarget`, mỗi target tự có `connectionId()` | Id suy ra từ target |
| `PrinterDescriptor` | `UsbDiscoveredDevice` / `BluetoothDiscoveredDevice` | Kết quả `listDevices`, không phải "máy in"; mỗi loại 1 dạng |
| `PrinterWriteResult` + `PrinterErrorCode` | `ConnectionException` + `ConnectionErrorCode` | Lỗi là exception, mã lỗi thuộc kết nối |
| `IPrinterDiscovery` + `UsbPrinterDiscovery` / `BluetoothPrinterDiscovery` | `UsbDeviceLookup` / `BluetoothDeviceLookup` | Vừa liệt kê vừa tìm thiết bị khớp target |
| `UsbPermission` (quyền + phát sự kiện rút USB) | `UsbPermissionRequester` + `UsbDetachReceiver` | Tách 2 trách nhiệm |
| `UsbConnectionWatcher` / `BluetoothConnectionWatcher` | `UsbDetachReceiver` / `BluetoothDisconnectReceiver` | Tên theo broadcast nhận được |
| `UsbEndpointResolver` | `UsbEndpoints` | Chọn cả interface, bulk OUT và bulk IN |
| `PrinterQueueTask`, `ConnectionState`, `IdentityStability`, `ConnectionType` | bỏ; `ConnectionType` thay bằng 3 loại target | Không còn chỗ dùng |
| — | `ConnectionLostReason` | Lý do mất kết nối gửi kèm sự kiện |

Interface đặt tiền tố `I` theo `docs/CODING_STANDARDS.md` Rule 8.3.

#### 0.3 Đổi tên phía TS (chỉ các file chạm tới cầu nối)

| Hiện tại | Mới |
|---|---|
| `adapters/native/PrinterNativeModule.ts`, export `ThermalPrinterModule` | `adapters/native/DeviceConnectionModule.ts`, export `DeviceConnectionModule` |
| `PrinterInfoDto` | `NativeDiscoveredDevice` |
| `ConnectRequest` / `UsbConnectRequest` / `BluetoothConnectRequest` / `LanConnectRequest` | `NativeConnectionTarget` / `NativeUsbTarget` / `NativeBluetoothTarget` / `NativeLanTarget` |
| `subscribeConnectionLost(cb: (identity) => …)` | `subscribeConnectionLost(cb: (event: ConnectionLostEvent) => …)` |
| `NativeAdapter.getConnectionIdentity()`, field `connectionIdentity` | `getConnectionId()`, field `connectionId` |
| — | `adapters/native/NativeConnectionPool.ts` (`acquire` / `release`) |
| `transports/UsbTransport.ts` | xoá |

Kiểu ở cầu nối mang tiền tố `Native` để phân biệt với kiểu nghiệp vụ cùng nghĩa bên TS (`PrinterConnection`,
`PrinterConnectTarget`). Model TS `PrinterDevice` (thiết bị tìm thấy khi thêm máy in) cũng ghép "Printer + Device";
đổi tên nó thuộc spec tầng TS, ghi lại ở đó.

### 1. Hợp đồng JS ↔ native

Kiểu phía TS (trong `adapters/native/DeviceConnectionModule.ts`):

```ts
interface NativeUsbTarget {
  readonly type: 'usb';
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber: string | null;
}

interface NativeBluetoothTarget {
  readonly type: 'bluetooth';
  readonly address: string;
}

interface NativeLanTarget {
  readonly type: 'lan';
  readonly host: string;
  readonly port: number;
}

type NativeConnectionTarget = NativeUsbTarget | NativeBluetoothTarget | NativeLanTarget;

type NativeDiscoveredDevice =
  | {
      readonly type: 'usb';
      readonly connectionId: string;
      readonly vendorId: number;
      readonly productId: number;
      readonly serialNumber: string | null;
      readonly manufacturerName: string | null;
      readonly productName: string | null;
      readonly hasPermission: boolean;
    }
  | {
      readonly type: 'bluetooth';
      readonly connectionId: string;
      readonly address: string;
      readonly name: string | null;
    };

type ConnectionLostReason = 'usb_detached' | 'bluetooth_disconnected' | 'io_error';

interface ConnectionLostEvent {
  readonly connectionId: string;
  readonly reason: ConnectionLostReason;
}
```

| Hàm native | Tham số | Kết quả | Ghi chú |
|---|---|---|---|
| `listDevices(type)` | `'usb'` \| `'bluetooth'` | `NativeDiscoveredDevice[]` | Không mở hộp thoại quyền. USB: chỉ thiết bị có bulk OUT. Bluetooth tắt/thiếu quyền → reject |
| `connect(target)` | `NativeConnectionTarget` | `connectionId` | Kết nối đang mở → trả `connectionId` đó, không mở thêm |
| `write(connectionId, base64Data, timeoutMs)` | | `void` | Ghi đủ toàn bộ byte trong `timeoutMs`, nếu không thì reject |
| `read(connectionId, maxBytes, timeoutMs)` | | base64 \| `null` | `null` khi hết `timeoutMs` mà không có byte nào |
| `disconnect(connectionId)` | | `void` | Gọi khi chưa kết nối vẫn resolve |
| Sự kiện `DeviceConnectionLost` | | `ConnectionLostEvent` | Phát khi mất kết nối ngoài ý muốn |

`write`, `read`, `disconnect` của cùng `connectionId` chạy **đúng thứ tự gọi** (cùng hàng đợi của `ActiveConnection`),
nên "ghi lệnh dò rồi đọc phản hồi" không bị lệnh khác chen vào. `disconnect` chờ các thao tác đã xếp trước nó chạy xong.

Đổi so với hiện tại: `discoverPrinters` → `listDevices`, `writeByBase64(printerId, …)` → `write(connectionId, …)`,
`disconnect(printerId)` → `disconnect(connectionId)`; payload sự kiện `identity` → `connectionId` + `reason`.

### 2. `connectionId`

#### 2.1 Định dạng

Trùng định dạng `identityKey` hiện có bên TS (`resolveIdentityKey`), để một máy in đã lưu luôn có
`connectionId === identityKey` mà không phải đổi dữ liệu đã lưu:

| Loại | Định dạng | Ví dụ |
|---|---|---|
| USB có serial | `usb:<vendorId>:<productId>:<serialNumber>` | `usb:8137:8214:SN123` |
| USB không serial | `usb:<vendorId>:<productId>` | `usb:8137:8214` |
| Bluetooth | `bluetooth:mac:<address>` | `bluetooth:mac:66:22:A1:B2:C3:D4` |
| LAN | `lan:<host>:<port>` | `lan:192.168.1.50:9100` |

vendorId/productId viết hệ thập phân. `address` giữ nguyên như TS truyền vào (lấy từ `listDevices`, Android trả viết
hoa). Hiện native dùng `USB:`/`BLUETOOTH:`/`LAN:` viết hoa và Bluetooth thiếu `mac:`; đổi theo bảng trên.

#### 2.2 Suy ra từ target, không từ thiết bị

`connectionId` tính từ target TS truyền vào, không từ thông tin native đọc được sau khi mở. Lý do: từ Android 10,
`UsbDevice.getSerialNumber()` cần quyền USB, nên lúc quét chưa có quyền thì serial là `null`; nếu sau khi cấp quyền
native lại tự thêm serial vào id thì id sẽ lệch với `identityKey` đã lưu.

#### 2.3 Khớp thiết bị USB khi `connect`

1. Lấy các thiết bị đang cắm có cùng `vendorId` + `productId` và có endpoint bulk OUT.
2. Không có → `DEVICE_NOT_FOUND`.
3. `target.serialNumber === null`:
   - đúng 1 thiết bị → dùng thiết bị đó;
   - nhiều hơn 1 → `AMBIGUOUS_DEVICE` (không đoán).
4. `target.serialNumber !== null`: duyệt các ứng viên, ưu tiên thiết bị đã có quyền; thiết bị chưa có quyền thì xin
   quyền rồi mới đọc serial. Serial khớp → dùng; không ứng viên nào khớp → `DEVICE_NOT_FOUND`.
5. Xin quyền USB (hộp thoại hệ thống) khi thiết bị được chọn chưa có quyền; chờ tối đa 30s; từ chối/hết giờ/rút ra
   giữa chừng → `PERMISSION_DENIED`.

### 3. Transport

```java
public interface ITransport {
    void open() throws ConnectionException;
    void write(byte[] data, long deadlineMillis) throws ConnectionException;
    byte[] read(int maxBytes, long deadlineMillis) throws ConnectionException;
    void close();
    boolean isOpen();
    String hardwareAddress();
}
```

`read` trả mảng rỗng khi hết hạn mà không có byte. `close` không ném lỗi và gọi nhiều lần không sao. Hạn dùng mốc thời
gian tuyệt đối (`deadlineMillis`) để một lần ghi nhiều khúc không cộng dồn timeout.

#### 3.1 `UsbTransport`

- `open`: `openDevice` + `claimInterface(force=true)` trên interface có endpoint bulk OUT; lưu endpoint bulk IN nếu có.
- `write`: chia khúc tối đa 16 KB (giới hạn an toàn của `bulkTransfer` trên Android cũ), lặp tới khi ghi đủ; mỗi khúc
  dùng timeout = thời gian còn lại tới deadline. `bulkTransfer` trả < 0 → `WRITE_FAILED`, hoặc `WRITE_TIMEOUT` nếu đã
  hết hạn; kèm số byte đã ghi.
- `read`: không có endpoint bulk IN → `READ_NOT_SUPPORTED`; có → `bulkTransfer` IN với timeout còn lại.
- Giữ `UsbDevice` để `UsbDetachReceiver` khớp sự kiện rút ra theo `getDeviceName()`.

#### 3.2 `BluetoothTransport`

- `open`: tìm trong thiết bị đã ghép đôi theo địa chỉ (không có → `DEVICE_NOT_FOUND`), RFCOMM theo SPP UUID, thử
  lại 1 lần như hiện tại. Bluetooth tắt → `BLUETOOTH_DISABLED`; `SecurityException` (thiếu `BLUETOOTH_CONNECT`) →
  `PERMISSION_DENIED`.
- `write`: ghi + `flush`. `BluetoothSocket` không có timeout ghi; nếu ghi vượt deadline thì đóng socket để giải phóng
  luồng và báo `WRITE_TIMEOUT`.
- `read`: `BluetoothSocket` không có timeout đọc → hỏi `available()` theo chu kỳ ngắn tới deadline rồi mới `read`.
- `close`: giữ cách chờ dữ liệu cuối kịp gửi trước khi đóng (`flush` không bảo đảm máy in đã nhận) theo số byte của
  lần ghi gần nhất — giới hạn đã biết, ghi rõ trong comment.

#### 3.3 `LanTransport`

- `open`: `Socket.connect` timeout 5s. Lỗi → `CONNECTION_FAILED`.
- `write`: ghi + `flush`; vượt deadline → đóng socket, `WRITE_TIMEOUT`.
- `read`: `setSoTimeout(thời gian còn lại)`; `SocketTimeoutException` khi chưa có byte → mảng rỗng.

### 4. Kết nối đang mở và luồng

- **`ActiveConnection`**: `connectionId` + một `ITransport` + một executor một luồng. `write`, `read`, `close` đều xếp
  vào executor này. Lỗi I/O trên Bluetooth/LAN (không phải hết hạn) → đóng và báo mất kết nối `io_error`. Khi đóng vì
  mất kết nối, mọi thao tác đang chờ bị reject `CONNECTION_LOST`.
- **`ConnectionManager`**: bảng `connectionId → ActiveConnection`.
  - `connect(target)` chạy trên executor dùng chung cho việc mở kết nối. Hai lời gọi `connect` cùng `connectionId`
    đồng thời dùng chung một lần mở (không mở 2 lần).
  - Kết nối có trong bảng nhưng transport đã chết → đóng và mở lại.
  - `handleDeviceLost(hardwareAddress, reason)` (từ `UsbDetachReceiver`, `BluetoothDisconnectReceiver` hoặc lỗi I/O):
    bỏ khỏi bảng, phát `DeviceConnectionLost`, đóng transport trên luồng nền (đóng Bluetooth có thể chờ vài giây;
    broadcast chạy trên luồng UI).
  - Một kết nối mất chỉ được báo **một lần**, dù cùng lúc có cả broadcast lẫn lỗi I/O.
- **`invalidate()`** của `DeviceConnectionModule` (React Native gọi khi reload): huỷ đăng ký receiver, đóng mọi kết
  nối, tắt mọi executor.

### 5. Mã lỗi (`ConnectionErrorCode`)

Reject bằng `promise.reject(code, message)`; `WRITE_*` thêm `userInfo.bytesWritten`.

| Mã | Khi nào |
|---|---|
| `INVALID_ARGUMENT` | Target sai kiểu/thiếu trường, `timeoutMs` ≤ 0, `maxBytes` ≤ 0 |
| `DEVICE_NOT_FOUND` | Không thấy thiết bị khớp target |
| `AMBIGUOUS_DEVICE` | Nhiều USB cùng vid/pid mà target không có serial |
| `PERMISSION_DENIED` | Từ chối/hết giờ hộp thoại quyền USB; thiếu quyền Bluetooth |
| `BLUETOOTH_DISABLED` | Bluetooth đang tắt hoặc máy không có Bluetooth |
| `CONNECTION_FAILED` | Mở kết nối thất bại |
| `NOT_CONNECTED` | `write`/`read` với `connectionId` không có kết nối đang mở |
| `CONNECTION_LOST` | Kết nối bị mất trong lúc thao tác đang chờ |
| `WRITE_FAILED` | Lỗi I/O khi ghi |
| `WRITE_TIMEOUT` | Ghi chưa đủ byte khi tới hạn |
| `READ_NOT_SUPPORTED` | USB không có endpoint bulk IN |
| `READ_FAILED` | Lỗi I/O khi đọc |

TS ánh xạ các mã này sang `PrinterErrorCode` trong `NativeAdapter`.

### 6. Cấu trúc tầng native

#### 6.1 Cây file

```
android/app/src/main/java/com/ndtcorepos/deviceconnection/
├── DeviceConnectionPackage.java         # đăng ký module với React Native
├── DeviceConnectionModule.java          # cầu nối JS: đọc tham số, gọi ConnectionManager, trả Promise, phát sự kiện
│
├── ConnectionManager.java               # connectionId → ActiveConnection: mở, dùng lại, đóng, xử lý mất kết nối
├── ActiveConnection.java                # 1 kết nối đang mở: transport + hàng đợi tuần tự
├── IConnectionTarget.java               # thông tin để kết nối, tự suy ra connectionId
├── ITransport.java                      # mở/ghi/đọc/đóng byte trên 1 đường truyền
├── ITransportFactory.java               # tạo transport cho 1 target
├── TransportFactory.java                # chọn transport theo loại target
├── IConnectionLostListener.java         # nhận báo một kết nối đã mất
├── ConnectionLostReason.java
├── ConnectionException.java             # lỗi có mã + số byte đã ghi
├── ConnectionErrorCode.java
├── Deadline.java                        # tính thời gian còn lại tới mốc hết hạn
│
├── usb/
│   ├── UsbTarget.java                   # vendorId + productId + serial
│   ├── UsbDiscoveredDevice.java
│   ├── UsbDeviceLookup.java             # liệt kê USB in được; tìm UsbDevice khớp target
│   ├── UsbDeviceMatcher.java            # luật chọn 1 thiết bị trong các ứng viên (Java thuần)
│   ├── UsbEndpoints.java                # chọn interface và endpoint bulk OUT / bulk IN
│   ├── UsbPermissionRequester.java      # xin quyền USB và chờ kết quả
│   ├── UsbChunkedWriter.java            # chia khúc, ghi đủ trước hạn (Java thuần)
│   ├── UsbTransport.java
│   └── UsbDetachReceiver.java           # broadcast rút USB → báo mất kết nối
├── bluetooth/
│   ├── BluetoothTarget.java
│   ├── BluetoothDiscoveredDevice.java
│   ├── BluetoothDeviceLookup.java       # thiết bị đã ghép đôi; tìm theo địa chỉ
│   ├── BluetoothTransport.java
│   └── BluetoothDisconnectReceiver.java # broadcast mất kết nối Bluetooth → báo mất kết nối
└── lan/
    ├── LanTarget.java
    └── LanTransport.java
```

29 file, mỗi file đúng 1 khái niệm. Hiện tại có 37 file nhưng một khái niệm bị chia ra 3–4 file (connection + writer +
device + queue), còn `ThermalPrinterModule` ôm phần lớn logic.

#### 6.2 Hướng phụ thuộc

```
DeviceConnectionModule ──► ConnectionManager ──► ActiveConnection ──► ITransport ◄── Usb/Bluetooth/LanTransport
   │                           │
   │                           └──► ITransportFactory ◄── TransportFactory ──► usb/, bluetooth/, lan/
   ├──► UsbDeviceLookup, BluetoothDeviceLookup                       (listDevices)
   └──► UsbDetachReceiver, BluetoothDisconnectReceiver ──► ConnectionManager.handleDeviceLost

ConnectionManager ──► IConnectionLostListener (DeviceConnectionModule cài đặt, phát sự kiện lên JS)
```

- Chỉ `DeviceConnectionModule` dùng kiểu React Native (`ReadableMap`, `WritableMap`, `Promise`).
- `ConnectionManager`, `ActiveConnection`, `*Target`, `UsbDeviceMatcher`, `UsbChunkedWriter`, `Deadline`,
  `ConnectionException` không dùng API Android nên test được bằng JUnit thuần.
- Gói gốc không import `usb/`, `bluetooth/`, `lan/`, trừ hai nơi lắp ráp: `DeviceConnectionModule` và
  `TransportFactory`.

#### 6.3 Từng class

**`DeviceConnectionModule`** — chỉ dịch giữa JS và Java, không có logic kết nối.

```java
@ReactMethod void listDevices(String type, Promise promise)
@ReactMethod void connect(ReadableMap target, Promise promise)
@ReactMethod void write(String connectionId, String base64Data, double timeoutMs, Promise promise)
@ReactMethod void read(String connectionId, double maxBytes, double timeoutMs, Promise promise)
@ReactMethod void disconnect(String connectionId, Promise promise)
@Override void invalidate()
```

- Số từ JS đến dạng `double` → đổi sang `long`/`int`; ≤ 0 thì reject `INVALID_ARGUMENT`.
- `readTarget(ReadableMap)` → `UsbTarget` / `BluetoothTarget` / `LanTarget`.
- Gắn callback vào `CompletableFuture` của `ConnectionManager` để resolve/reject; không bao giờ `get()` chờ.
- Cài `IConnectionLostListener`: phát `DeviceConnectionLost` `{ connectionId, reason }`.
- `invalidate()`: huỷ đăng ký 2 receiver, `connectionManager.closeAll()`.

**`ConnectionManager`** — giữ các kết nối đang mở theo `connectionId`.

```java
ConnectionManager(ITransportFactory transportFactory, IConnectionLostListener connectionLostListener)
CompletableFuture<String> connect(IConnectionTarget target)
CompletableFuture<Void> write(String connectionId, byte[] data, long timeoutMillis)
CompletableFuture<byte[]> read(String connectionId, int maxBytes, long timeoutMillis)
CompletableFuture<Void> disconnect(String connectionId)
void handleDeviceLost(String hardwareAddress, ConnectionLostReason reason)
void closeAll()
```

- Field: `activeConnections` (`connectionId → ActiveConnection`), `pendingConnects` (`connectionId → future` đang
  mở), `connectExecutor` (nhiều luồng), `abortExecutor` (1 luồng).
- `connect`: đã mở và còn sống → trả ngay; đang mở dở cùng `connectionId` → trả chung future; đã mở nhưng transport
  chết → bỏ và mở lại; chưa có → `connectExecutor` chạy `transportFactory.create(target)` + `transport.open()`.
- `write`/`read`: không có kết nối → `NOT_CONNECTED`; có → giao cho `ActiveConnection`.
- `disconnect`: bỏ khỏi bảng, `activeConnection.close()` (chờ thao tác đã xếp trước); không có kết nối vẫn xong.
- `handleDeviceLost`: tìm kết nối có `hardwareAddress` trùng; không có → bỏ qua. Bỏ khỏi bảng (chỉ lần bỏ đầu tiên
  thành công nên chỉ báo 1 lần), gọi `connectionLostListener`, rồi `abortExecutor` chạy `activeConnection.abort()`.
- Lỗi I/O do `ActiveConnection` báo về đi cùng đường `handleDeviceLost` với lý do `IO_ERROR`.

**`ActiveConnection`** — một kết nối đang mở.

```java
ActiveConnection(String connectionId, ITransport transport, Consumer<ActiveConnection> ioFailureHandler)
String connectionId()
String hardwareAddress()
boolean isOpen()
CompletableFuture<Void> write(byte[] data, long timeoutMillis)
CompletableFuture<byte[]> read(int maxBytes, long timeoutMillis)
CompletableFuture<Void> close()
void abort()
```

- Mọi thao tác xếp vào 1 executor một luồng → chạy đúng thứ tự gọi.
- Hạn của một thao tác tính **lúc nó bắt đầu chạy** (`Deadline.after(timeoutMillis)`), không tính thời gian chờ thao
  tác trước.
- `WRITE_FAILED`/`READ_FAILED` (không phải hết hạn) → gọi `ioFailureHandler`.
- `close()`: xếp sau các thao tác trước, đóng transport, tắt executor.
- `abort()`: không chờ — đóng transport ngay để giải phóng luồng đang kẹt trong ghi/đọc; thao tác đang chạy và đang
  chờ kết thúc với `CONNECTION_LOST`.

**`IConnectionTarget`** + `UsbTarget` / `BluetoothTarget` / `LanTarget`

```java
public interface IConnectionTarget {
    String connectionId();
}

static UsbTarget UsbTarget.of(int vendorId, int productId, String serialNumber) throws ConnectionException
static BluetoothTarget BluetoothTarget.of(String address) throws ConnectionException
static LanTarget LanTarget.of(String host, int port) throws ConnectionException
```

- Kiểm tra tham số ngay khi tạo: vendorId/productId 0–65535, serial rỗng coi là `null`, address/host không rỗng,
  port 1–65535; sai → `INVALID_ARGUMENT`.
- `connectionId()` theo bảng §2.1.

**`ITransport`** — như §3, có thêm `hardwareAddress()`: địa chỉ phần cứng để khớp broadcast với kết nối. USB là
`UsbDevice.getDeviceName()` (vd `/dev/bus/usb/001/004`, khác nhau giữa 2 máy cùng model), Bluetooth là địa chỉ MAC,
LAN là `host:port`.

**`ITransportFactory`** / **`TransportFactory`**

```java
ITransport create(IConnectionTarget target) throws ConnectionException
```

Chạy trên luồng mở kết nối, được phép chờ (xin quyền USB). `TransportFactory(UsbManager, UsbDeviceLookup,
BluetoothDeviceLookup)` chọn theo loại target, mỗi loại 1 hàm riêng:

- USB → `usbDeviceLookup.find(target)` rồi `new UsbTransport(usbManager, device)`;
- Bluetooth → `bluetoothDeviceLookup.findBonded(address)` rồi `new BluetoothTransport(device)`;
- LAN → `new LanTransport(host, port)`.

**`ConnectionException`** / **`ConnectionErrorCode`** / **`ConnectionLostReason`** / **`IConnectionLostListener`**

```java
ConnectionException(ConnectionErrorCode code, String message)
ConnectionException withBytesWritten(int bytesWritten)
ConnectionErrorCode code()
int bytesWritten()

enum ConnectionLostReason { USB_DETACHED, BLUETOOTH_DISCONNECTED, IO_ERROR }   // wireValue(): "usb_detached"…

void onConnectionLost(String connectionId, ConnectionLostReason reason)
```

**`Deadline`**

```java
static long after(long timeoutMillis)
static long remainingMillis(long deadlineMillis)
static boolean isExpired(long deadlineMillis)
```

**`usb/`**

| Class | Thành phần chính | Ghi chú |
|---|---|---|
| `UsbDiscoveredDevice` | `connectionId`, `vendorId`, `productId`, `serialNumber`, `manufacturerName`, `productName`, `hasPermission` | Bất biến |
| `UsbDeviceLookup(UsbManager, UsbPermissionRequester)` | `listDevices()`, `UsbDevice find(UsbTarget)` | `find` lọc vid/pid + có bulk OUT, xếp thiết bị đã có quyền lên trước, giao `UsbDeviceMatcher` chọn |
| `UsbDeviceMatcher` | `static <T> T choose(List<T> candidates, UsbTarget target, ISerialReader<T> serialReader)` | Luật §2.3. `ISerialReader` đọc serial, xin quyền nếu cần. Generic để test không cần `UsbDevice` |
| `UsbEndpoints` | `findPrinterInterface(UsbDevice)`, `findBulkOut(UsbInterface)`, `findBulkIn(UsbInterface)` | Hàm static, dùng chung cho lookup và transport |
| `UsbPermissionRequester(Context, UsbManager)` | `hasPermission(UsbDevice)`, `ensurePermission(UsbDevice)` | Chờ tối đa 30s. Mỗi lần xin đăng ký receiver tạm (`RECEIVER_NOT_EXPORTED`) cho kết quả quyền và việc rút đúng thiết bị đó, xong thì huỷ |
| `UsbChunkedWriter` | `static void writeAll(byte[] data, long deadlineMillis, IChunkWriter chunkWriter)` | Khúc tối đa 16 KB; ghi tới đủ; hết hạn → `WRITE_TIMEOUT` kèm số byte đã ghi |
| `UsbTransport(UsbManager, UsbDevice)` | `ITransport` | `open` claim interface; `write` qua `UsbChunkedWriter` với `bulkTransfer(endpoint, buffer, offset, length, timeout)`; `read` bulk IN |
| `UsbDetachReceiver(Context, ConnectionManager)` | `register()`, `unregister()` | `ACTION_USB_DEVICE_DETACHED` → `handleDeviceLost(deviceName, USB_DETACHED)` |

**`bluetooth/`**

| Class | Thành phần chính | Ghi chú |
|---|---|---|
| `BluetoothDiscoveredDevice` | `connectionId`, `address`, `name` | Bất biến |
| `BluetoothDeviceLookup(Context)` | `listDevices()`, `BluetoothDevice findBonded(String address)` | Bluetooth tắt → `BLUETOOTH_DISABLED`; thiếu quyền → `PERMISSION_DENIED`; không có địa chỉ → `DEVICE_NOT_FOUND` |
| `BluetoothTransport(BluetoothDevice)` | `ITransport` | RFCOMM SPP, thử lại 1 lần; hẹn giờ đóng socket tại deadline khi ghi, huỷ hẹn khi ghi xong; đọc bằng `available()` theo chu kỳ |
| `BluetoothDisconnectReceiver(Context, ConnectionManager)` | `register()`, `unregister()` | `ACTION_ACL_DISCONNECTED` → `handleDeviceLost(address, BLUETOOTH_DISCONNECTED)` |

**`lan/`**

| Class | Thành phần chính | Ghi chú |
|---|---|---|
| `LanTransport(String host, int port)` | `ITransport` | Kết nối timeout 5s; `setSoTimeout` khi đọc; hẹn giờ đóng socket tại deadline khi ghi |

#### 6.4 Luồng chạy

| Luồng | Chạy gì |
|---|---|
| Luồng native module của RN | Đọc tham số, gọi `ConnectionManager`, gắn callback — không chờ gì |
| `connectExecutor` (nhiều luồng) | `TransportFactory.create` + `open` (chờ hộp thoại quyền USB tới 30s, socket tới 5s) |
| Luồng riêng của mỗi `ActiveConnection` | `write`, `read`, `close` theo đúng thứ tự gọi |
| `abortExecutor` (1 luồng) | Đóng transport của kết nối bị mất (đóng Bluetooth có thể chờ vài giây) |
| Luồng UI | Broadcast rút USB / mất Bluetooth → chỉ gọi `handleDeviceLost` |

#### 6.5 Các luồng chính

**connect**

```
JS connect(target)
 → DeviceConnectionModule.readTarget → UsbTarget.of(…)       sai tham số → reject INVALID_ARGUMENT ngay
 → ConnectionManager.connect(target)
     đang mở và còn sống        → resolve connectionId
     đang có lần mở cùng id     → dùng chung future
     chưa có                    → connectExecutor: TransportFactory.create → transport.open
                                  → new ActiveConnection → activeConnections
 → resolve(connectionId)
```

**write**

```
JS write(connectionId, base64Data, timeoutMs)
 → DeviceConnectionModule giải base64
 → ConnectionManager.write → ActiveConnection.write → xếp vào luồng của kết nối
 → tới lượt: deadline = now + timeoutMs → transport.write(data, deadline)
 → resolve, hoặc reject WRITE_TIMEOUT / WRITE_FAILED kèm bytesWritten
```

**mất kết nối**

```
Rút USB (luồng UI) → UsbDetachReceiver → handleDeviceLost("/dev/bus/usb/001/004", USB_DETACHED)
Lỗi I/O khi ghi/đọc Bluetooth/LAN → ActiveConnection → handleDeviceLost(hardwareAddress, IO_ERROR)
 → tìm kết nối có hardwareAddress trùng; không có → bỏ qua
 → bỏ khỏi activeConnections (chỉ lần đầu thành công → báo đúng 1 lần)
 → DeviceConnectionModule phát DeviceConnectionLost { connectionId, reason }
 → abortExecutor: activeConnection.abort() → thao tác đang chờ reject CONNECTION_LOST
```

Xoá toàn bộ thư mục `com/ndtcorepos/thermalprinter/`. Cập nhật:

- `MainApplication.kt`: import và `add(DeviceConnectionPackage())`.
- `AndroidManifest.xml`: comment đang nhắc `com.ndtcorepos.thermalprinter`.
- `CLAUDE.md`, `docs/CODING_STANDARDS.md` (ví dụ tên interface ở Rule 8.3): đường dẫn và tên class cũ.
- `jest.setup.js`: mock `NativeModules.ThermalPrinterModule` → `DeviceConnectionModule`.

Code theo `docs/CODING_STANDARDS.md` (guard clause, tối đa 2 cấp lồng, `LOG_SOURCE`, comment WHY).

### 7. Thay đổi phía TS (tối thiểu để app chạy với API mới)

- `adapters/native/DeviceConnectionModule.ts` (đổi tên từ `PrinterNativeModule.ts`): kiểu và hàm theo §1;
  `subscribeConnectionLost` nhận `ConnectionLostEvent`.
- `adapters/native/NativeConnectionPool.ts` (mới): đếm số người dùng theo `connectionId` — `acquire(target)` gọi native
  `connect` khi là người đầu tiên, `release(connectionId)` gọi native `disconnect` khi là người cuối.
- `adapters/native/NativeAdapter.ts`: dùng `NativeConnectionPool`; lưu `connectionId`; `canRead = true`; `read()` gọi
  native; `getConnectionId()`; ánh xạ mã lỗi §5.
- `adapters/IPrinterAdapter.ts`: `PrinterConnectTarget.usb` thêm `serialNumber`; `toConnectTarget` truyền serial.
- `NativeAdapter.listDevices`: USB `deviceId` dùng `connectionId` (có serial) thay cho `` `${vendorId}:${productId}` ``.
- Xoá `transports/UsbTransport.ts` và test của nó (native đã chia khúc).
- Đổi theo tên mới: `EscPosDriver`, `TsplDriver`, `adapters/resolvePrinterAdapter.ts`,
  `connection/PrinterConnectionLock.ts` (comment), `hooks/addPrinter/useConnectionSetup.ts`,
  `adapters/testing/MockPrinterAdapter.ts`, cùng các test `NativeAdapter`, `PrinterNativeModule` (đổi tên theo file),
  `EscPosDriver`, `MockPrinterAdapter`.

## Quy ước code (bắt buộc, áp cho mọi file Java và TS mới/sửa trong đợt này)

Giống quy ước đã dùng cho printer-core, cộng `docs/CODING_STANDARDS.md` (Java) và `docs/CODING_STANDARDS_TS.md` (TS).

1. **Summary ngắn, tiếng Việt.** Mỗi class/interface/type export có 1 dòng summary nói trách nhiệm. Mỗi field có 1 dòng
   nói ý nghĩa + đơn vị (ms, byte…) + ràng buộc nếu có; bỏ qua field mà tên đã hiển nhiên tuyệt đối. Method public chỉ
   có summary khi tên + tham số chưa đủ rõ.
2. **Không Javadoc rập khuôn.** Không `@param`/`@return` lặp lại tên và kiểu (kiểu `@param data raw printer bytes`,
   `@return operation result` đang có ở code cũ). Chỉ ghi `@throws`/tham số khi có điều không hiển nhiên (đơn vị, mốc
   thời gian tuyệt đối…).
3. **Cách dòng:** 1 dòng trống giữa các field (kèm summary của nó) và giữa các method; dòng trống giữa các khối logic
   trong hàm; không dòng trống thừa (code cũ có chỗ 2 dòng trống liền).
4. **Comment trong code:** tiếng Việt, 1–3 dòng, chỉ giải thích WHY (giới hạn phần cứng, hành vi Android không hiển
   nhiên). Không mô tả lại code, không kể lịch sử ("Task 4", "port từ…"), **không tham chiếu tài liệu** (số mục spec
   như "§2.1", "see the design spec", tên plan/task): comment phải tự đủ nghĩa khi đọc riêng. Comment cho Android API
   đặt ở đầu hàm, không rải từng dòng (Rule 14.3).
5. **Độ dài dòng ≤ 120 ký tự**, đo bằng Node `line.length`.
6. **Nesting:** Java ≤ 2 cấp (Rule 3.3), TS ≤ 3 cấp; dùng guard clause/early return, không `else` sau `return`.
7. **1 hàm 1 trách nhiệm**, không hàm lồng trong hàm (TS); `switch`/`if` theo loại kết nối chỉ điều phối, mỗi nhánh
   gọi 1 hàm riêng.
8. **Không magic number:** hằng số `UPPER_SNAKE_CASE`, tên có đơn vị (`PERMISSION_TIMEOUT_MS`, `USB_CHUNK_SIZE_BYTES`).
9. **Tên đầy đủ, theo từ vựng §0.1**, không viết tắt (`connection` không `conn`, `exception` không `e`).
10. **Tham số:** ≥ 3 tham số thì mỗi tham số 1 dòng; ít hơn thì viết trên 1 dòng (code cũ xuống dòng cả hàm 1 tham số).
11. **TS import module khác qua barrel `index.ts`** nếu module đó có barrel.
12. **Verify trước mỗi commit:** `./gradlew :app:compileDebugJavaWithJavac` + `:app:testDebugUnitTest` (khi đụng Java),
    `npm run verify`, line-length.

Mẫu Java:

```java
/** Một kết nối đang mở: transport + hàng đợi để mọi thao tác chạy đúng thứ tự gọi. */
final class ActiveConnection {

    private static final String LOG_SOURCE = "ActiveConnection";

    /** Mã kết nối, suy ra từ target nên cùng target luôn ra cùng mã. */
    private final String connectionId;

    private final ITransport transport;

    /** Một luồng duy nhất: ghi/đọc/đóng của cùng kết nối không bao giờ chạy song song. */
    private final ExecutorService operationExecutor = Executors.newSingleThreadExecutor();

    ActiveConnection(String connectionId, ITransport transport) {
        this.connectionId = connectionId;
        this.transport = transport;
    }

    /** Hạn ghi tính từ lúc tới lượt chạy, không tính thời gian chờ thao tác trước. */
    CompletableFuture<Void> write(byte[] data, long timeoutMillis) {
        return CompletableFuture.runAsync(() -> writeBeforeDeadline(data, timeoutMillis), operationExecutor);
    }
}
```

Mẫu TS:

```ts
/** Thiết bị USB `listDevices` tìm thấy, chưa kết nối. */
export interface NativeUsbDevice {
  readonly type: 'usb';

  /** Mã kết nối native sẽ trả khi `connect` thiết bị này. */
  readonly connectionId: string;

  /** `null` khi chưa có quyền USB (Android 10+ cần quyền mới đọc được serial). */
  readonly serialNumber: string | null;

  /** App đã được cấp quyền USB cho thiết bị này chưa; quét không mở hộp thoại xin quyền. */
  readonly hasPermission: boolean;
}
```

## Test

**JVM unit test** (JUnit, thêm `testImplementation` vào `android/app/build.gradle`) cho phần không phụ thuộc
Android:

- `UsbTarget`/`BluetoothTarget`/`LanTarget`: tham số hợp lệ/không hợp lệ; `connectionId()` đúng định dạng §2.1
  (USB có/không serial, Bluetooth, LAN) và trùng `resolveIdentityKey` bên TS với cùng dữ liệu.
- `UsbDeviceMatcher` (luật §2.3): không có ứng viên, một, nhiều mà không serial, serial khớp/không khớp, đọc serial
  bị từ chối quyền.
- `ActiveConnection` với transport giả: thao tác chạy đúng thứ tự gọi; `close` chờ thao tác trước; mất kết nối reject
  thao tác đang chờ `CONNECTION_LOST`.
- `ConnectionManager` với transport giả: `connect` trùng chỉ mở 1 lần; báo mất kết nối đúng một lần.
- `UsbChunkedWriter`: payload 40 KB → 3 khúc 16/16/8 KB; hết hạn khi chưa ghi đủ → `WRITE_TIMEOUT` kèm số byte đã ghi.
- `ConnectionManager.handleDeviceLost`: khớp đúng kết nối theo `hardwareAddress`, không đụng kết nối khác.

**Jest** cho TS: `NativeConnectionPool` (đếm người dùng, connect/disconnect đúng lúc), `NativeAdapter` (ánh xạ mã lỗi,
read, truyền serial) với `NativeModules` giả.

**Kiểm tra trên máy thật** (bắt buộc, test tự động không chạy tới broadcast/USB/Bluetooth thật):

1. USB: hộp thoại quyền — đồng ý, từ chối, rút dây khi hộp thoại đang mở.
2. USB: in bill ESC/POS và tem TSPL có ảnh lớn hơn 16 KB.
3. USB: rút dây lúc rảnh và lúc đang in → app nhận mất kết nối đúng một lần, cắm lại kết nối được.
4. USB: 2 máy cùng model (nếu có) → in đúng máy; rút một máy không ảnh hưởng máy kia.
5. TSPL qua USB: `read` nhận phản hồi lệnh dò (nếu máy có endpoint IN).
6. Bluetooth: kết nối, in, ra khỏi tầm sóng → mất kết nối; tắt Bluetooth → `BLUETOOTH_DISABLED`.
7. LAN: kết nối, in; IP sai → `CONNECTION_FAILED` sau khoảng 5s, app không bị treo trong lúc chờ.
8. Đang in một máy thì kết nối/in máy khác → không phải chờ (bridge không bị chặn).
9. Reload JS nhiều lần → không rò kết nối (kết nối lại được ngay).

## Tiêu chí hoàn thành

- API native đúng §1; native không còn `printerId`.
- Tên đúng §0; cấu trúc file đúng §6; thư mục `thermalprinter/` đã xoá; không còn tên cũ trong code và tài liệu đang
  dùng (`grep` `thermalprinter`, `ThermalPrinterModule`, `getConnectionIdentity` ra rỗng, trừ spec/plan cũ).
- 10 lỗi trong bảng "Lỗi hiện tại được sửa" đều có test tự động hoặc mục kiểm tra trên máy thật tương ứng.
- `./gradlew :app:testDebugUnitTest` xanh; `npm run verify` xanh.
- Danh sách kiểm tra trên máy thật đã chạy, kết quả ghi lại trong PR.

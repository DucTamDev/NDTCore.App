# Tầng native thiết bị (`com.ndtcorepos`) — Design Spec

## Mục tiêu

Thiết kế mới tầng native Android (Java) của app, thay toàn bộ `com.ndtcorepos.thermalprinter`.

Tầng native chỉ làm "đường ống" tới thiết bị ngoại vi: tìm thiết bị, xin quyền, kết nối, ghi/đọc byte, báo mất kết
nối. Native **chỉ nhận địa chỉ thiết bị** và trả về `connectionId`; không biết `printerId`, máy in đã lưu, giao thức
(ESC/POS, TSPL), khổ giấy hay loại bản in — những thứ đó thuộc tầng TS.

## Nguyên tắc đã chốt

- **Native chỉ nhận địa chỉ.** `connectionId` suy ra từ địa chỉ TS truyền vào, nên cùng địa chỉ luôn ra cùng
  `connectionId`.
- **Một kết nối vật lý = một `Connection`.** Native không biết hai địa chỉ (USB và LAN) có phải cùng một máy hay không;
  "một máy in nhiều đường kết nối" là quyết định nghiệp vụ của TS.
- **Dùng chung kết nối do TS quản lý.** Hai máy in đã lưu cùng một địa chỉ thì TS đếm số người dùng và chỉ gọi
  `disconnect` khi không còn ai. Native: `connect` lại cùng địa chỉ trả về kết nối đang mở; `disconnect` đóng ngay.
- **Native không hiển thị UI** (không `Toast`); mọi thông báo cho người dùng do TS hiển thị bằng tiếng Việt.
- **Không chặn luồng của native module.** Việc chậm (xin quyền USB, mở socket, ghi, đọc, đóng) chạy trên luồng riêng;
  Promise được resolve/reject từ luồng đó.

## Ngoài phạm vi

- Tái cấu trúc tầng TS máy in (gộp `adapters/` + `transports/`, bỏ `LibraryAdapter`, chuyển TSPL Bluetooth/LAN sang
  native, đổi tên `PrinterDevice`…). Đợt này TS chỉ sửa đủ để chạy với API native mới (§8).
- Thu hẹp `connectionResourceKey` của `PrintScheduler` (native mới cho phép song song theo `connectionId`, nhưng đổi
  lịch in thuộc tầng TS).
- Quét máy in LAN; lọc thiết bị Bluetooth theo loại (trả mọi thiết bị đã ghép đôi).
- iOS.
- Tính năng native khác (màn hình phụ, máy thanh toán…): cấu trúc §1 đã chừa chỗ, chưa làm.

## Hành vi phải đúng (lỗi đang có ở code hiện tại)

| # | Hiện tại | Phải đúng |
|---|---|---|
| 1 | Kết nối USB chỉ tìm theo vendorId/productId → 2 máy cùng model luôn lấy máy đầu | Khớp serial (§4.3) |
| 2 | Rút 1 máy USB, máy cùng model cũng bị coi là mất | Khớp theo đường dẫn thiết bị (`hardwareAddress`) |
| 3 | Rút USB được xử lý ở 2 nơi không phối hợp | Một đường duy nhất: monitor → `ConnectionPool` |
| 4 | Ghi chặn luồng native module tới 15s; kết nối chặn tới 30s khi chờ hộp thoại quyền USB | Chạy trên luồng riêng |
| 5 | USB ghi cả payload 1 lần; ghi thiếu byte vẫn báo thành công | Chia khúc, ghi đủ mới thành công |
| 6 | Timeout ghi Bluetooth/LAN bị bỏ qua; 2 mức timeout chồng nhau | Một hạn do TS truyền |
| 7 | Native không đọc được phản hồi | Có `read` |
| 8 | Receiver nhận cả broadcast từ app khác | Receiver chỉ nhận trong app |
| 9 | `Toast` tiếng Anh từ native | Bỏ |
| 10 | Kết quả "ghi" dùng cho cả mở/đóng kết nối | Lỗi là `DeviceException`, thành công không trả gì |

## Thiết kế

### 1. Cấu trúc

```
android/app/src/main/java/com/ndtcorepos/
├── MainActivity.kt                         # khung React Native, giữ nguyên
├── MainApplication.kt                      # add(NdtCorePosPackage())
│
├── bridge/                                 # nói chuyện với JS — nơi duy nhất import React Native
│   ├── NdtCorePosPackage.java              # đăng ký các module
│   └── device/
│       ├── DeviceModule.java               # các hàm JS gọi + phát sự kiện
│       └── DeviceMapper.java               # đổi dữ liệu JS ↔ Java
│
├── common/                                 # Java thuần dùng chung mọi tính năng
│   └── CodedException.java                 # lỗi có mã, JS nhận được mã này
│
└── device/
    ├── DeviceFactory.java                  # tạo và nối mọi phần của device
    ├── DeviceService.java                  # cửa vào duy nhất của device; bridge chỉ gọi class này
    │
    ├── model/                              # dữ liệu
    │   ├── DeviceType.java
    │   ├── DeviceAddress.java
    │   ├── DeviceInfo.java
    │   └── DisconnectReason.java
    │
    ├── error/                              # lỗi
    │   ├── DeviceException.java
    │   └── DeviceErrorCode.java
    │
    ├── discovery/                          # tìm thiết bị
    │   ├── IDeviceDiscovery.java
    │   ├── UsbDiscovery.java
    │   └── BluetoothDiscovery.java
    │
    ├── permission/                         # xin quyền
    │   └── UsbPermission.java
    │
    ├── connection/                         # kết nối đang mở
    │   ├── IDisconnectListener.java
    │   ├── ConnectionPool.java
    │   └── Connection.java
    │
    ├── transport/                          # truyền byte
    │   ├── ITransport.java
    │   ├── ITransportFactory.java
    │   ├── TransportFactory.java
    │   ├── UsbTransport.java
    │   ├── BluetoothTransport.java
    │   └── LanTransport.java
    │
    └── monitor/                            # theo dõi rút / mất kết nối
        ├── IDisconnectMonitor.java
        ├── UsbDetachMonitor.java
        └── BluetoothDisconnectMonitor.java
```

26 file Java. Xoá toàn bộ `com/ndtcorepos/thermalprinter/`.

**Hướng gọi** (một chiều, không vòng):

```
JS ─► DeviceModule ─► DeviceFactory.create ─► DeviceService ─┬─► discovery/
                                                             └─► ConnectionPool ─► Connection ─► ITransport
                                                                      ▲                              ▲
                                                                  monitor/          TransportFactory ┘
                                                                                          │
                                                                              discovery/, permission/
ConnectionPool ─► IDisconnectListener (DeviceModule cài đặt) ─► sự kiện JS
```

**Quy tắc:**

1. Chỉ `bridge/` import `com.facebook.react.*`.
2. `bridge/` chỉ dùng `DeviceFactory`, `DeviceService`, `model/`, `error/`, `connection/IDisconnectListener`.
3. Các folder trong `device/` gọi theo đúng hướng trên, không gọi ngược.
4. `model/`, `error/`, `connection/`, `DeviceService`, `common/` không dùng API Android → test bằng JUnit thuần.
5. `DeviceFactory` là nơi duy nhất `new` các phần của device; class khác nhận dependency qua constructor.
6. Interface đặt tiền tố `I` (`docs/CODING_STANDARDS.md` Rule 8.3); class cài đặt không có tiền tố. Chỉ tách
   interface khi có ≥ 2 cài đặt hoặc cần bản giả để test.

**Tính năng native sau này** đi theo cùng khuôn: `bridge/<tinhnang>/<TinhNang>Module` + `<tinhnang>/` (có
`<TinhNang>Factory`, `<TinhNang>Service`, các folder theo việc), cùng đăng ký trong `NdtCorePosPackage`. Ngăn kéo tiền
(lệnh ESC/POS qua máy in) và máy quét mã vạch dạng bàn phím không cần native riêng.

### 2. Từng phần

#### `bridge/`

| File | Làm gì | Hàm chính |
|---|---|---|
| `NdtCorePosPackage` | Đăng ký module với React Native | `createNativeModules()` → `[new DeviceModule(reactContext)]` |
| `device/DeviceModule` | Hàm JS gọi: nhận tham số, gọi `DeviceService`, trả Promise. Cài `IDisconnectListener` để phát `DeviceDisconnected` | `discover`, `connect`, `write`, `read`, `disconnect`, `invalidate()` |
| `device/DeviceMapper` | Đổi dữ liệu JS ↔ Java; tham số sai → `INVALID_ARGUMENT` | `toDeviceType(String)`, `toAddress(ReadableMap)`, `toWritableArray(List<DeviceInfo>)` |

- Constructor `DeviceModule`: `deviceService = DeviceFactory.create(reactContext, this)`.
- Không bao giờ đứng chờ: gắn callback vào `CompletableFuture`; lỗi reject bằng `CodedException.code()`, lỗi ghi thêm
  `userInfo.bytesWritten`.
- Số từ JS đến dạng `double` → đổi sang `long`/`int`; ≤ 0 → `INVALID_ARGUMENT`.
- `invalidate()` (React Native gọi khi reload) → `deviceService.close()`.

#### `common/`

| File | Làm gì |
|---|---|
| `CodedException` | Lớp cha trừu tượng của mọi lỗi có mã (`code()`); `bridge/` reject bằng mã này mà không cần biết tính năng |

Chỉ Java thuần; chỉ thêm file khi có ≥ 2 tính năng cần.

#### `device/DeviceFactory`

| Hàm | Làm gì |
|---|---|
| `static DeviceService create(Context context, IDisconnectListener listener)` | Tạo `UsbPermission`, `UsbDiscovery`, `BluetoothDiscovery`, `TransportFactory`, `ConnectionPool(transportFactory, listener)`, `UsbDetachMonitor`, `BluetoothDisconnectMonitor` và các executor; tạo `DeviceService` rồi gọi `start()` |

#### `device/DeviceService`

| Hàm | Làm gì |
|---|---|
| `DeviceService(Map<DeviceType, IDeviceDiscovery> discoveries, ConnectionPool connectionPool, List<IDisconnectMonitor> monitors, ExecutorService discoveryExecutor)` | Nhận dependency |
| `start()` | Bật các monitor |
| `CompletableFuture<List<DeviceInfo>> discover(DeviceType type)` | Chọn discovery theo loại, quét trên luồng quét; LAN → `INVALID_ARGUMENT` |
| `CompletableFuture<String> connect(DeviceAddress address)` | → `ConnectionPool.connect` |
| `write`, `read`, `disconnect` | → `ConnectionPool` |
| `close()` | Tắt monitor, `connectionPool.closeAll()`, tắt luồng quét |

#### `device/model/` (bất biến, không logic)

| File | Nội dung |
|---|---|
| `DeviceType` | `USB`, `BLUETOOTH`, `LAN`; `wireValue()` = `"usb"`, `"bluetooth"`, `"lan"` |
| `DeviceAddress` | Cách tới một thiết bị. Tạo bằng `usb(vendorId, productId, serialNumber)`, `bluetooth(mac)`, `lan(host, port)`, kiểm tra tham số ngay (§4.1); `connectionId()` |
| `DeviceInfo` | Một thiết bị tìm thấy: `type`, `connectionId`, `name`; USB thêm `vendorId`, `productId`, `serialNumber`, `manufacturerName`, `productName`, `hasPermission`; Bluetooth thêm `mac` |
| `DisconnectReason` | `USB_DETACHED`, `BLUETOOTH_DISCONNECTED`, `IO_ERROR`; `wireValue()` = `"usb_detached"`… |

#### `device/error/`

| File | Nội dung |
|---|---|
| `DeviceErrorCode` | 12 mã (§5) |
| `DeviceException` | Kế thừa `CodedException`: mã, thông báo, `bytesWritten` (lỗi ghi) |

#### `device/discovery/`

| File | Làm gì | Hàm chính |
|---|---|---|
| `IDeviceDiscovery` | Việc chung của mọi cách quét | `List<DeviceInfo> discover() throws DeviceException` |
| `UsbDiscovery` | Liệt kê USB đang cắm có endpoint bulk OUT; đọc serial nếu đã có quyền; tìm đúng máy cho một địa chỉ (§4.3) | `discover()`, `UsbDevice find(DeviceAddress address)` |
| `BluetoothDiscovery` | Liệt kê thiết bị đã ghép đôi; tìm theo MAC | `discover()`, `BluetoothDevice findBonded(String mac)` |

- Luật chọn USB viết thành hàm static trên dữ liệu đơn giản (danh sách serial) để test JUnit.
- Bluetooth tắt → `BLUETOOTH_DISABLED`; thiếu quyền → `PERMISSION_DENIED`; không có MAC → `DEVICE_NOT_FOUND`.

#### `device/permission/`

| File | Làm gì | Hàm chính |
|---|---|---|
| `UsbPermission` | Hỏi người dùng cho phép dùng một thiết bị USB và chờ kết quả | `hasPermission(UsbDevice)`, `request(UsbDevice)` |

- `request` chờ tối đa 30s; từ chối / hết giờ / rút dây khi hộp thoại đang mở → `PERMISSION_DENIED`.
- Mỗi lần xin đăng ký receiver tạm (`RECEIVER_NOT_EXPORTED`) cho kết quả quyền và việc rút đúng thiết bị đó, xong thì
  huỷ.
- Quyền Bluetooth là quyền runtime, do TS xin (`PrinterPermissionService`).

#### `device/connection/` (không dùng API Android)

| File | Làm gì | Hàm chính |
|---|---|---|
| `ConnectionPool` | Giữ kết nối đang mở theo `connectionId`: mở, dùng lại, đóng, xử lý khi mất | `connect(address)`, `write(connectionId, data, timeoutMillis)`, `read(connectionId, maxBytes, timeoutMillis)`, `disconnect(connectionId)`, `onHardwareLost(hardwareAddress, reason)`, `closeAll()` |
| `Connection` | Một kết nối đang mở; mọi thao tác chạy lần lượt trên một luồng riêng | `write`, `read`, `close()`, `abort()`, `hardwareAddress()` |
| `IDisconnectListener` | `ConnectionPool` báo ra ngoài khi một kết nối mất | `onDisconnected(connectionId, reason)` |

`ConnectionPool`:

- `connect` cùng địa chỉ khi đang mở và còn sống → trả ngay; hai lời gọi `connect` đồng thời cùng địa chỉ → mở một
  lần, dùng chung kết quả; đang có nhưng transport đã chết → bỏ và mở lại; chưa có → luồng mở kết nối chạy
  `transportFactory.create(address)` + `open()`.
- `write`/`read` với `connectionId` chưa mở → `NOT_CONNECTED`.
- `disconnect` → bỏ khỏi pool, `connection.close()`; chưa mở vẫn xong.
- `onHardwareLost` → tìm kết nối có `hardwareAddress` trùng (không có thì bỏ qua), bỏ khỏi pool (chỉ lần bỏ đầu tiên
  thành công → báo đúng một lần), báo `IDisconnectListener`, rồi `connection.abort()` trên luồng nền.

`Connection`:

- Hạn của mỗi thao tác tính **lúc nó bắt đầu chạy**, không tính thời gian xếp hàng.
- `WRITE_FAILED`/`READ_FAILED` (không phải hết hạn) → báo `ConnectionPool.onHardwareLost(hardwareAddress, IO_ERROR)`.
- `close()` chờ các thao tác xếp trước chạy xong rồi đóng transport.
- `abort()` đóng transport ngay để giải phóng luồng đang kẹt; thao tác đang chạy và đang chờ kết thúc với
  `CONNECTION_LOST`.

#### `device/transport/`

| File | Làm gì |
|---|---|
| `ITransport` | `open()`, `write(byte[] data, long deadlineMillis)`, `read(int maxBytes, long deadlineMillis)` (mảng rỗng khi hết hạn), `close()` (không ném lỗi, gọi nhiều lần không sao), `isOpen()`, `hardwareAddress()` |
| `ITransportFactory` | `ITransport create(DeviceAddress address) throws DeviceException`; được phép chờ (xin quyền USB) |
| `TransportFactory` | Chọn theo `DeviceType`, mỗi loại 1 hàm: USB → `usbDiscovery.find` → `UsbTransport`; Bluetooth → `bluetoothDiscovery.findBonded` → `BluetoothTransport`; LAN → `LanTransport` |
| `UsbTransport` | Chiếm interface có bulk OUT; ghi chia khúc 16 KB tới khi đủ (hàm static test được); đọc qua bulk IN, không có → `READ_NOT_SUPPORTED`; `hardwareAddress` = `UsbDevice.getDeviceName()` (vd `/dev/bus/usb/001/004`) |
| `BluetoothTransport` | RFCOMM SPP, thử lại 1 lần; ghi có hẹn giờ đóng socket tại hạn; đọc bằng `available()` theo chu kỳ; trước khi đóng chờ dữ liệu cuối kịp gửi (`flush` không bảo đảm máy in đã nhận); `hardwareAddress` = MAC |
| `LanTransport` | TCP, kết nối timeout 5s; đọc dùng `setSoTimeout`; ghi có hẹn giờ đóng socket tại hạn; `hardwareAddress` = `host:port` |

Hạn là mốc thời gian tuyệt đối (`deadlineMillis`) để một lần ghi nhiều khúc không cộng dồn timeout. Hết hạn khi chưa
ghi đủ → `WRITE_TIMEOUT` kèm số byte đã ghi.

#### `device/monitor/`

| File | Làm gì |
|---|---|
| `IDisconnectMonitor` | `start()`, `stop()` |
| `UsbDetachMonitor` | Broadcast rút USB → `connectionPool.onHardwareLost(deviceName, USB_DETACHED)` |
| `BluetoothDisconnectMonitor` | Broadcast mất kết nối Bluetooth → `connectionPool.onHardwareLost(mac, BLUETOOTH_DISCONNECTED)` |

Receiver đăng ký `RECEIVER_NOT_EXPORTED`. LAN không có broadcast; mất kết nối LAN phát hiện qua lỗi ghi/đọc
(`IO_ERROR`).

### 3. Hợp đồng JS ↔ native

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
| Sự kiện `DeviceDisconnected` | | `DeviceDisconnectedEvent` | Mất kết nối ngoài ý muốn |

`write`, `read`, `disconnect` của cùng `connectionId` chạy đúng thứ tự gọi, nên "ghi lệnh dò rồi đọc phản hồi" không bị
lệnh khác chen vào; `disconnect` chờ thao tác xếp trước nó chạy xong.

Kiểu ở cầu nối mang tiền tố `Native` để phân biệt với kiểu nghiệp vụ cùng nghĩa bên TS (`PrinterConnection`,
`PrinterConnectTarget`).

### 4. `connectionId`

#### 4.1 Định dạng và kiểm tra địa chỉ

Trùng `identityKey` hiện có bên TS (`resolveIdentityKey`), để máy in đã lưu luôn có `connectionId === identityKey` mà
không phải đổi dữ liệu đã lưu:

| Loại | Định dạng | Ví dụ | Kiểm tra |
|---|---|---|---|
| USB có serial | `usb:<vendorId>:<productId>:<serialNumber>` | `usb:8137:8214:SN123` | vendorId/productId 0–65535 |
| USB không serial | `usb:<vendorId>:<productId>` | `usb:8137:8214` | serial rỗng coi là `null` |
| Bluetooth | `bluetooth:mac:<mac>` | `bluetooth:mac:66:22:A1:B2:C3:D4` | mac không rỗng |
| LAN | `lan:<host>:<port>` | `lan:192.168.1.50:9100` | host không rỗng, port 1–65535 |

vendorId/productId viết hệ thập phân; `mac` giữ nguyên như TS truyền (lấy từ `discover`, Android trả viết hoa).

#### 4.2 Suy ra từ địa chỉ, không từ thiết bị

Từ Android 10, `UsbDevice.getSerialNumber()` cần quyền USB, nên lúc quét chưa có quyền thì serial là `null`. Nếu sau khi
cấp quyền native tự thêm serial vào id thì id sẽ lệch với `identityKey` đã lưu — vì vậy id luôn tính từ địa chỉ TS
truyền vào.

#### 4.3 Chọn thiết bị USB khi kết nối

1. Lấy các thiết bị đang cắm cùng vendorId + productId và có endpoint bulk OUT. Không có → `DEVICE_NOT_FOUND`.
2. Địa chỉ không có serial: đúng 1 thiết bị → dùng; nhiều hơn → `AMBIGUOUS_DEVICE`.
3. Địa chỉ có serial: duyệt ứng viên, thiết bị đã có quyền trước; thiết bị chưa có quyền thì xin quyền rồi đọc serial.
   Khớp → dùng; không ứng viên nào khớp → `DEVICE_NOT_FOUND`.
4. Thiết bị được chọn chưa có quyền → xin quyền (`UsbPermission`).

### 5. Mã lỗi (`DeviceErrorCode`)

Reject bằng `promise.reject(code, message)`; `WRITE_*` thêm `userInfo.bytesWritten`.

| Mã | Khi nào |
|---|---|
| `INVALID_ARGUMENT` | Địa chỉ sai kiểu/thiếu trường; `timeoutMs`/`maxBytes` ≤ 0; `discover('lan')` |
| `DEVICE_NOT_FOUND` | Không thấy thiết bị khớp địa chỉ |
| `AMBIGUOUS_DEVICE` | Nhiều USB cùng vendorId/productId mà địa chỉ không có serial |
| `PERMISSION_DENIED` | Từ chối/hết giờ hộp thoại quyền USB; thiếu quyền Bluetooth |
| `BLUETOOTH_DISABLED` | Bluetooth tắt hoặc máy không có Bluetooth |
| `CONNECTION_FAILED` | Mở kết nối thất bại |
| `NOT_CONNECTED` | `write`/`read` với `connectionId` chưa mở |
| `CONNECTION_LOST` | Kết nối mất khi thao tác đang chờ |
| `WRITE_FAILED` | Lỗi I/O khi ghi |
| `WRITE_TIMEOUT` | Hết hạn khi chưa ghi đủ |
| `READ_NOT_SUPPORTED` | USB không có endpoint bulk IN |
| `READ_FAILED` | Lỗi I/O khi đọc |

TS ánh xạ sang `PrinterErrorCode` trong `NativeAdapter`.

### 6. Luồng chạy

| Luồng | Chạy gì |
|---|---|
| Luồng của native module | `DeviceModule` nhận lời gọi, gắn callback, trả về ngay |
| Luồng quét (1 luồng, trong `DeviceService`) | `discover` |
| Luồng mở kết nối (nhiều luồng, trong `ConnectionPool`) | `TransportFactory.create` + `open` (chờ quyền USB tới 30s, socket tới 5s) |
| Luồng riêng của mỗi `Connection` | `write`, `read`, `close` theo đúng thứ tự gọi |
| Luồng đóng khẩn (1 luồng, trong `ConnectionPool`) | `abort()` kết nối bị mất (đóng Bluetooth có thể chờ vài giây) |
| Luồng UI | Broadcast của monitor, chỉ gọi `onHardwareLost` |

Executor được tạo trong `DeviceFactory` và truyền qua constructor để test chạy đồng bộ.

### 7. Ví dụ: in 1 bill qua USB

```
JS connect({ type: 'usb', vendorId, productId, serialNumber })
  DeviceModule → DeviceMapper.toAddress → DeviceService.connect → ConnectionPool.connect
  → luồng mở kết nối: TransportFactory.create → UsbDiscovery.find (xin quyền nếu cần) → new UsbTransport → open
  → new Connection → resolve "usb:8137:8214:SN123"

JS write("usb:8137:8214:SN123", base64Bill, 10000)
  → ConnectionPool.write → Connection.write (xếp hàng) → tới lượt: hạn = bây giờ + 10s
  → UsbTransport.write (chia khúc 16 KB) → resolve

Rút dây USB
  → UsbDetachMonitor → ConnectionPool.onHardwareLost("/dev/bus/usb/001/004", USB_DETACHED)
  → IDisconnectListener → DeviceModule phát DeviceDisconnected { connectionId, reason: "usb_detached" }
  → Connection.abort() → thao tác đang chờ reject CONNECTION_LOST
```

### 8. Thay đổi phía TS (tối thiểu để app chạy với API mới)

- `adapters/native/PrinterNativeModule.ts` → `adapters/native/DeviceModule.ts`: kiểu và hàm theo §3;
  `subscribeDeviceDisconnected(callback: (event: DeviceDisconnectedEvent) => void)`.
- `adapters/native/NativeConnectionPool.ts` (mới): đếm số người dùng theo `connectionId` — `acquire(address)` gọi native
  `connect` khi là người đầu tiên, `release(connectionId)` gọi native `disconnect` khi là người cuối.
- `adapters/native/NativeAdapter.ts`: dùng `NativeConnectionPool`; lưu `connectionId`; `canRead = true`; `read()` gọi
  native; `getConnectionIdentity()` → `getConnectionId()`; ánh xạ mã lỗi §5; `listDevices` USB dùng `connectionId`
  làm `deviceId`.
- `adapters/IPrinterAdapter.ts`: `PrinterConnectTarget.usb` thêm `serialNumber`; `toConnectTarget` truyền serial.
- Xoá `transports/UsbTransport.ts` và test của nó (native đã chia khúc).
- Đổi theo tên mới: `EscPosDriver`, `TsplDriver`, `adapters/resolvePrinterAdapter.ts`,
  `connection/PrinterConnectionLock.ts`, `hooks/addPrinter/useConnectionSetup.ts`,
  `adapters/testing/MockPrinterAdapter.ts` và các test liên quan; `jest.setup.js` mock `NativeModules.DeviceModule`.

### 9. File khác cần cập nhật

- `MainApplication.kt`: import + `add(NdtCorePosPackage())`.
- `AndroidManifest.xml`: comment đang nhắc `com.ndtcorepos.thermalprinter`.
- `android/app/build.gradle`: `testImplementation 'junit:junit:4.13.2'` và
  `testOptions.unitTests.returnDefaultValues = true` (lời gọi `android.util.Log` trong JUnit không làm test lỗi).
- `CLAUDE.md`, `docs/CODING_STANDARDS.md` (ví dụ tên interface ở Rule 8.3), `src/features/printer/ARCHITECTURE.md`
  (nếu nhắc native): đường dẫn và tên class mới.

## Quy ước code (bắt buộc cho mọi file Java và TS mới/sửa)

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

    Connection(String connectionId, ITransport transport, ExecutorService operationExecutor) {
        this.connectionId = connectionId;
        this.transport = transport;
        this.operationExecutor = operationExecutor;
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

## Test

**JUnit** (`android/app/src/test/java/com/ndtcorepos/`, cùng cấu trúc package):

```
test/java/com/ndtcorepos/
├── common/CodedExceptionTest.java
└── device/
    ├── DeviceServiceTest.java              # chọn discovery theo loại, LAN → INVALID_ARGUMENT, close tắt monitor
    ├── model/DeviceAddressTest.java        # kiểm tra tham số; connectionId đúng §4.1, trùng resolveIdentityKey bên TS
    ├── discovery/UsbDiscoveryTest.java     # luật chọn §4.3: không có, một, nhiều không serial, serial khớp/không
    ├── connection/
    │   ├── FakeTransport.java              # ITransport giả
    │   ├── FakeTransportFactory.java
    │   ├── ConnectionTest.java             # đúng thứ tự gọi, hạn tính lúc bắt đầu, close chờ, abort → CONNECTION_LOST
    │   └── ConnectionPoolTest.java         # dùng lại, connect đồng thời mở 1 lần, NOT_CONNECTED, onHardwareLost
    │                                       # đúng kết nối và báo đúng 1 lần, IO_ERROR
    └── transport/UsbTransportTest.java     # chia khúc 40 KB → 16/16/8; hết hạn → WRITE_TIMEOUT kèm byte đã ghi
```

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
7. LAN: kết nối, in; IP sai → `CONNECTION_FAILED` sau khoảng 5s, app không treo.
8. Đang in một máy thì kết nối/in máy khác → không phải chờ.
9. Reload JS nhiều lần → không rò kết nối (kết nối lại được ngay).

## Tiêu chí hoàn thành

- Cấu trúc và tên đúng §1–§2; `com/ndtcorepos/thermalprinter/` đã xoá.
- API JS đúng §3; native không còn `printerId`.
- `grep` `thermalprinter`, `ThermalPrinterModule`, `getConnectionIdentity` trong code và tài liệu đang dùng ra rỗng
  (trừ spec/plan cũ).
- 10 hành vi trong bảng "Hành vi phải đúng" đều có test tự động hoặc mục kiểm tra trên máy thật.
- `./gradlew :app:testDebugUnitTest` xanh; `npm run verify` xanh.
- Danh sách kiểm tra trên máy thật đã chạy, kết quả ghi trong PR.

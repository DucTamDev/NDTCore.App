# Tầng native máy in: chỉ nhận kết nối, gọn theo transport — Design Spec

## Mục tiêu

Tầng native (`com.ndtcorepos.thermalprinter`, Java, Android) chỉ làm "đường ống": liệt kê thiết bị, mở kết nối, ghi
byte, đọc byte, đóng kết nối, báo mất kết nối. Native **chỉ nhận thông tin kết nối** và trả về `connectionId`; không
biết `printerId`, máy in đã lưu, giao thức, khổ giấy hay loại bản in.

Đồng thời gom 37 file hiện tại (chia theo vai trò `connection/`, `writer/`, `device/`, `discovery/`, `identity/`,
`permission/`, `queue/`) thành khoảng 17 file chia theo loại kết nối, và sửa các lỗi thật tìm thấy khi review.

## Nguyên tắc đã chốt

- **Native chỉ nhận connection.** Không có `printerId` ở native. Mã kết nối (`connectionId`) suy ra từ thông tin kết nối
  mà TS truyền vào, nên cùng thông tin luôn ra cùng `connectionId`.
- **Một kết nối vật lý = một phiên (session).** Native không biết hai kết nối (USB và LAN) có phải cùng một máy
  hay không. "Một máy in nhiều đường kết nối" là quyết định nghiệp vụ của TS.
- **Dùng chung kết nối do TS quản lý.** Hai máy in đã lưu trỏ cùng một kết nối thì TS đếm số người dùng và chỉ gọi
  `disconnect` khi không còn ai. Native: `connect` lại cùng thông tin trả về phiên đang mở; `disconnect` đóng ngay.
- **Native không hiển thị UI.** Bỏ các `Toast` tiếng Anh hiện có; mọi thông báo cho người dùng do TS hiển thị.
- **Không chặn luồng bridge.** Mọi thao tác chậm (xin quyền USB, mở socket, ghi, đọc, đóng) chạy trên luồng riêng;
  Promise được resolve/reject từ luồng đó.
- **Giữ tên module** `ThermalPrinterModule` và package `com.ndtcorepos.thermalprinter`.

## Ngoài phạm vi

- Gộp `adapters/` + `transports/` bên TS, bỏ `LibraryAdapter`, chuyển TSPL Bluetooth/LAN sang native (làm ở spec tái cấu
  trúc tầng TS máy in, sau khi native có `read`).
- Thu hẹp `connectionResourceKey` của `PrintScheduler` (hiện USB dùng chung khoá `'usb'`, ESC/POS theo loại kết nối).
  Native mới cho phép song song theo `connectionId`, nhưng đổi lịch in thuộc spec TS.
- Quét máy in LAN; lọc thiết bị Bluetooth theo loại (hiện trả mọi thiết bị đã ghép đôi, giữ nguyên).
- iOS (`printTextLegacyIOS` giữ nguyên).
- Model "một máy in nhiều đường kết nối" bên TS.

## Lỗi hiện tại được sửa

| # | Lỗi | Sửa |
|---|---|---|
| 1 | `connect` USB chỉ tìm theo vendorId/productId, bỏ qua serial → 2 máy cùng model luôn lấy máy đầu | Khớp serial (§2.3) |
| 2 | Sự kiện rút USB khớp theo `vid:pid` → rút 1 máy, máy cùng model cũng bị coi là mất | Khớp theo `UsbDevice.getDeviceName()` của phiên |
| 3 | Rút USB được xử lý 2 lần: `UsbConnection` tự đóng và `UsbConnectionWatcher` dọn dẹp, không phối hợp | Một đường duy nhất qua `PrinterSessions` |
| 4 | `writeByBase64` chặn luồng bridge tới 15s; `connect` chặn tới 30s khi chờ hộp thoại quyền USB | Chạy trên luồng riêng (§4) |
| 5 | USB ghi cả payload bằng 1 lần `bulkTransfer`; ghi thiếu byte vẫn báo thành công | Chia khúc, ghi đủ mới thành công (§3.1) |
| 6 | Tham số `timeout` của writer Bluetooth/LAN bị bỏ qua; 2 mức timeout chồng nhau (5s, 15s) | Một deadline cho cả lần ghi do TS truyền |
| 7 | Native không đọc được (`read` luôn `null`) → TSPL phải đi `LibraryAdapter` | Thêm `read` (§1) |
| 8 | Receiver đăng ký `RECEIVER_EXPORTED` cho cả action quyền USB nội bộ | `RECEIVER_NOT_EXPORTED` |
| 9 | `Toast` tiếng Anh hiển thị từ native | Bỏ |
| 10 | `PrinterWriteResult` dùng cho cả `open`/`close` | Lỗi ném `PrinterException`, thao tác thành công không trả gì |

## Thiết kế

### 1. Hợp đồng JS ↔ native

Kiểu phía TS (trong `adapters/native/PrinterNativeModule.ts`):

```ts
type NativeConnectionTarget =
  | {
      readonly type: 'usb';
      readonly vendorId: number;
      readonly productId: number;
      readonly serialNumber: string | null;
    }
  | { readonly type: 'bluetooth'; readonly address: string }
  | { readonly type: 'lan'; readonly host: string; readonly port: number };

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
```

| Hàm native | Tham số | Kết quả | Ghi chú |
|---|---|---|---|
| `listDevices(type)` | `'usb'` \| `'bluetooth'` | `NativeDiscoveredDevice[]` | Không mở hộp thoại quyền. USB: chỉ thiết bị có endpoint bulk OUT |
| `connect(target)` | `NativeConnectionTarget` | `connectionId` | Gọi lại khi phiên đang mở → trả `connectionId` đó, không mở thêm |
| `write(connectionId, base64, timeoutMs)` | | `void` | Ghi đủ toàn bộ byte trong `timeoutMs`, nếu không thì reject |
| `read(connectionId, maxBytes, timeoutMs)` | | base64 \| `null` | `null` khi hết `timeoutMs` mà không có byte nào |
| `disconnect(connectionId)` | | `void` | Gọi khi chưa kết nối vẫn resolve |
| Sự kiện `ThermalPrinterConnectionLost` | | `{ connectionId, reason }` | Phát khi mất kết nối ngoài ý muốn |

`write`, `read`, `disconnect` của cùng `connectionId` chạy **đúng thứ tự gọi** (cùng một hàng đợi của phiên), nên
"ghi lệnh dò rồi đọc phản hồi" không bị lệnh khác chen vào. `disconnect` chờ các thao tác đã xếp trước nó chạy xong.

Đổi tên so với hiện tại: `discoverPrinters` → `listDevices`, `writeByBase64(printerId, …)` → `write(connectionId, …)`,
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

`connectionId` tính từ `NativeConnectionTarget` TS truyền vào, không từ thông tin native đọc được sau khi mở. Lý do:
từ Android 10, `UsbDevice.getSerialNumber()` cần quyền USB, nên lúc quét chưa có quyền thì serial là `null`; nếu sau khi
cấp quyền native lại tự thêm serial vào id thì id sẽ lệch với `identityKey` đã lưu.

#### 2.3 Khớp thiết bị USB khi `connect`

1. Lấy các thiết bị đang cắm có cùng `vendorId` + `productId` và có endpoint bulk OUT.
2. Không có → `DEVICE_NOT_FOUND`.
3. `target.serialNumber === null`:
   - đúng 1 thiết bị → dùng thiết bị đó;
   - nhiều hơn 1 → `AMBIGUOUS_DEVICE` (không đoán).
4. `target.serialNumber !== null`: duyệt các ứng viên, ưu tiên thiết bị đã có quyền; thiết bị chưa có quyền thì xin
   quyền rồi mới đọc serial. Serial khớp → dùng; không ứng viên nào khớp → `DEVICE_NOT_FOUND`.
5. Xin quyền USB (hộp thoại hệ thống) khi thiết bị được chọn chưa có quyền; chờ tối đa 30s; từ chối/hết giờ/rút ra giữa
   chừng → `PERMISSION_DENIED`.

### 3. Transport

```java
interface PrinterTransport {
    void open() throws PrinterException;
    void write(byte[] data, long deadlineMillis) throws PrinterException;
    byte[] read(int maxBytes, long deadlineMillis) throws PrinterException;
    void close();
    boolean isOpen();
}
```

`read` trả mảng rỗng khi hết hạn mà không có byte. `close` không ném lỗi và gọi nhiều lần không sao. Hạn dùng mốc thời
gian tuyệt đối (`deadlineMillis`) để một lần ghi nhiều khúc không cộng dồn timeout.

#### 3.1 `UsbTransport`

- `open`: `openDevice` + `claimInterface(force=true)` trên interface có endpoint bulk OUT; lưu endpoint bulk IN nếu có.
- `write`: chia khúc tối đa 16 KB (giới hạn an toàn của `bulkTransfer` trên Android cũ), lặp tới khi ghi đủ; mỗi khúc
  dùng timeout = thời gian còn lại tới deadline. `bulkTransfer` trả < 0 → `WRITE_FAILED` hoặc `WRITE_TIMEOUT` (hết hạn),
  kèm số byte đã ghi.
- `read`: không có endpoint bulk IN → `READ_NOT_SUPPORTED`; có → `bulkTransfer` IN với timeout còn lại.
- Giữ `UsbDevice` để khớp sự kiện rút ra theo `getDeviceName()`.

#### 3.2 `BluetoothTransport`

- `open`: tìm trong thiết bị đã ghép đôi theo địa chỉ (không có → `DEVICE_NOT_FOUND`), RFCOMM theo SPP UUID, thử
  lại 1 lần như hiện tại. Bluetooth tắt → `BLUETOOTH_DISABLED`; `SecurityException` (thiếu `BLUETOOTH_CONNECT`) →
  `PERMISSION_DENIED`.
- `write`: ghi + `flush`. `BluetoothSocket` không có timeout ghi; nếu ghi vượt deadline thì đóng socket để giải phóng
  luồng và báo `WRITE_TIMEOUT`.
- `read`: `BluetoothSocket` không có timeout đọc → hỏi `available()` theo chu kỳ ngắn tới deadline rồi mới `read`.
- `close`: giữ cách chờ dữ liệu cuối kịp gửi trước khi đóng (`flush` không bảo đảm máy in đã nhận) theo số byte của lần
  ghi gần nhất — đây là giới hạn đã biết, ghi rõ trong comment.

#### 3.3 `LanTransport`

- `open`: `Socket.connect` timeout 5s. Lỗi → `CONNECTION_FAILED`.
- `write`: ghi + `flush`; vượt deadline → đóng socket, `WRITE_TIMEOUT`.
- `read`: `setSoTimeout(thời gian còn lại)`; `SocketTimeoutException` khi chưa có byte → mảng rỗng.

### 4. Phiên và luồng

- **`PrinterSession`**: một `PrinterTransport` + một executor một luồng. `write`, `read`, `close` đều xếp vào executor
  này. Trạng thái `OPEN` → `CLOSED`. Lỗi I/O trên Bluetooth/LAN (không phải hết hạn) → đóng phiên và báo mất kết nối
  `io_error`. Khi phiên đóng vì mất kết nối, mọi thao tác đang chờ bị reject `CONNECTION_LOST`.
- **`PrinterSessions`**: bảng `connectionId → PrinterSession`.
  - `connect` chạy trên executor dùng chung cho việc mở kết nối. Hai lời gọi `connect` cùng `connectionId` đồng thời
    dùng chung một lần mở (không mở 2 lần).
  - Phiên có trong bảng nhưng transport đã chết → đóng và mở lại.
  - Nhận báo rút USB / mất Bluetooth / lỗi I/O → bỏ phiên khỏi bảng, phát `ThermalPrinterConnectionLost`, đóng transport
    trên luồng nền (đóng Bluetooth có thể chờ vài giây; broadcast chạy trên luồng UI).
  - Một phiên mất kết nối chỉ được báo **một lần**, dù cùng lúc có cả broadcast lẫn lỗi I/O.
- **`invalidate()`** (React Native gọi khi reload): huỷ đăng ký receiver, đóng mọi phiên, tắt mọi executor.

### 5. Mã lỗi

Reject bằng `promise.reject(code, message)`; `WRITE_*` thêm `userInfo.bytesWritten`.

| Mã | Khi nào |
|---|---|
| `INVALID_ARGUMENT` | Target sai kiểu/thiếu trường, `timeoutMs` ≤ 0, `maxBytes` ≤ 0 |
| `DEVICE_NOT_FOUND` | Không thấy thiết bị khớp target |
| `AMBIGUOUS_DEVICE` | Nhiều USB cùng vid/pid mà target không có serial |
| `PERMISSION_DENIED` | Từ chối/hết giờ hộp thoại quyền USB; thiếu quyền Bluetooth |
| `BLUETOOTH_DISABLED` | Bluetooth đang tắt hoặc máy không có Bluetooth |
| `CONNECTION_FAILED` | Mở kết nối thất bại |
| `NOT_CONNECTED` | `write`/`read` với `connectionId` không có phiên mở |
| `CONNECTION_LOST` | Phiên bị mất kết nối trong lúc thao tác đang chờ |
| `WRITE_FAILED` | Lỗi I/O khi ghi |
| `WRITE_TIMEOUT` | Ghi chưa đủ byte khi tới hạn |
| `READ_NOT_SUPPORTED` | USB không có endpoint bulk IN |
| `READ_FAILED` | Lỗi I/O khi đọc |

TS ánh xạ các mã này sang `PrinterErrorCode` trong `NativeAdapter`.

### 6. Cấu trúc file Java

```
thermalprinter/
├── ThermalPrinterPackage.java
├── ThermalPrinterModule.java     # chỉ cầu nối: đọc tham số → PrinterSessions → Promise/DTO, phát sự kiện
├── PrinterSessions.java          # connectionId → phiên; gộp connect trùng; xử lý mất kết nối
├── PrinterSession.java           # 1 transport + 1 hàng đợi tuần tự
├── PrinterTransport.java
├── ConnectionTarget.java         # target đã kiểm tra + connectionId() (§2)
├── PrinterException.java         # mã lỗi + bytesWritten
├── PrinterErrorCode.java
├── usb/
│   ├── UsbTransport.java
│   ├── UsbDevices.java           # liệt kê, khớp target (§2.3), chọn interface/endpoint
│   ├── UsbPermissionRequester.java
│   └── UsbDetachReceiver.java
├── bluetooth/
│   ├── BluetoothTransport.java
│   ├── BluetoothDevices.java     # thiết bị đã ghép đôi
│   └── BluetoothDisconnectReceiver.java
└── lan/
    └── LanTransport.java
```

Xoá: `connection/`, `writer/`, `device/`, `discovery/`, `identity/`, `permission/`, `queue/`, `model/`, `enums/`,
`module/` (2 file trong `module/` chuyển lên gốc). `MainApplication.kt` cập nhật import `ThermalPrinterPackage`.

Code theo `docs/CODING_STANDARDS.md` (guard clause, tối đa 2 cấp lồng, `LOG_SOURCE`, comment WHY).

### 7. Thay đổi phía TS (tối thiểu để app chạy với API mới)

- `adapters/native/PrinterNativeModule.ts`: kiểu và hàm theo §1; `subscribeConnectionLost` trả
  `{ connectionId, reason }`.
- `adapters/native/NativeConnections.ts` (mới): đếm số người dùng theo `connectionId` — `acquire(target)` gọi native
  `connect` khi là người đầu tiên, `release(connectionId)` gọi native `disconnect` khi là người cuối.
- `adapters/native/NativeAdapter.ts`: dùng `NativeConnections`; lưu `connectionId`; `canRead = true`; `read()` gọi
  native; `getConnectionIdentity()` đổi tên `getConnectionId()`; ánh xạ mã lỗi §5.
- `adapters/IPrinterAdapter.ts`: `PrinterConnectTarget.usb` thêm `serialNumber`; `toConnectTarget` truyền serial.
- `NativeAdapter.listDevices`: USB `deviceId` dùng `connectionId` (có serial) thay cho `` `${vendorId}:${productId}` ``.
- Xoá `transports/UsbTransport.ts` (native đã chia khúc); `EscPosDriver`/`TsplDriver` đổi theo tên mới.
- `hooks/addPrinter/useConnectionSetup.ts`: gọi `listDevices` thay `discoverPrinters`.

## Test

**JVM unit test** (JUnit, thêm `testImplementation` vào `android/app/build.gradle`) cho phần không phụ thuộc
Android:

- `ConnectionTarget`: đọc target hợp lệ/không hợp lệ; `connectionId()` đúng định dạng §2.1 (USB có/không serial,
  Bluetooth, LAN) và trùng `resolveIdentityKey` bên TS với cùng dữ liệu.
- Khớp USB (§2.3) tách thành hàm thuần trên danh sách ứng viên: không có, một, nhiều không serial, serial
  khớp/không khớp.
- `PrinterSession` với transport giả: thao tác chạy đúng thứ tự gọi; `disconnect` chờ thao tác trước; mất kết nối reject
  thao tác đang chờ `CONNECTION_LOST`; báo mất kết nối đúng một lần.
- Chia khúc ghi USB: payload 40 KB → 3 khúc 16/16/8 KB; ghi thiếu → `WRITE_TIMEOUT` kèm số byte đã ghi.

**Jest** cho TS: `NativeConnections` (đếm người dùng, connect/disconnect đúng lúc), `NativeAdapter` (ánh xạ mã lỗi,
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
- Cấu trúc file đúng §6; các thư mục cũ đã xoá.
- 10 lỗi trong bảng "Lỗi hiện tại được sửa" đều có test tự động hoặc mục kiểm tra trên máy thật tương ứng.
- `./gradlew :app:testDebugUnitTest` xanh; `npm run verify` xanh.
- Danh sách kiểm tra trên máy thật đã chạy, kết quả ghi lại trong PR.

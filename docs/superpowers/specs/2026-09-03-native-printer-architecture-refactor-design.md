# Native Printer Architecture Refactor — Design

Date: 2026-09-03
Status: Approved for planning

## 1. Goal

Refactor tầng native Android của thermal printer (`android/app/src/main/java/com/ndtcorepos/thermalprinter/`) từ 3 module RN rời rạc (`RNUSBPrinterModule`, `RNBLEPrinterModule`, `RNNetPrinterModule`, mỗi module ~100-700 dòng gộp cả discovery/permission/connection/protocol/logging) sang kiến trúc layered: RN bridge → application service → transport resolver → transport cụ thể theo connection type. Android không còn biết gì về ESC/POS/TSPL/receipt/label — chỉ transport raw bytes.

Phạm vi bao gồm cả JS bridge (`src/features/printer/adapters/native/PrinterNativeModule.ts` và mọi call site) vì việc gộp module bắt buộc đổi cách JS gọi native.

## 2. Hiện trạng (đã khảo sát)

- 3 native module đăng ký qua `RNPrinterPackage`: `RNUSBPrinter`, `RNBLEPrinter`, `RNNetPrinter` — implement chung interface `RNPrinterModule` (`init`, `closeConn`, `getDeviceList`, `printRawData`, `printImageData`, `printQrCode`, `printImageBase64`), cộng thêm `connectPrinter` với chữ ký khác nhau mỗi module (USB: `vendorId, productId`; BLE: `innerAddress`; LAN: `host, port`).
- Mỗi module delegate cho 1 `*Adapter` singleton (`USBPrinterAdapter` 696 dòng, `BLEPrinterAdapter` 536 dòng, `NetPrinterAdapter` 535 dòng) — adapter tự làm discovery + permission (USB) + connect + write + qr/image rendering, không tách lớp.
- JS side (`PrinterNativeModule.ts`) gọi thẳng `NativeModules.RNUSBPrinter/RNBLEPrinter/RNNetPrinter` theo tên, dùng 3 namespace `USBPrinter`/`BLEPrinter`/`NetPrinter` riêng.
- **API thực sự đang được gọi từ JS**: `init()`, `getDeviceList()` (USB, BLE — LAN nhập tay IP/port, không discovery), `connectPrinter()` (chữ ký riêng theo loại), `closeConn()`, `printRawData()` (trực tiếp + qua `printText` sau khi `EPToolkit` encode ESC/POS).
- **Dead code (không ai gọi từ JS)**: `printImageData()`, `printQrCode()`, `printImageBase64()` — kéo theo `UtilsImage.java`, zxing QR encode, `getBitmapFromURL`, và toàn bộ block bulk-transfer ảnh lặp lại 3 lần trong `USBPrinterAdapter` (và tương tự ở BLE/Net).
- USB permission: `USBPrinterAdapter` dùng `UsbManager.hasPermission`/`requestPermission` + `BroadcastReceiver` (`ACTION_USB_PERMISSION`). **Lưu ý hành vi hiện tại**: `connectPrinter`/`selectDevice` gọi `successCallback` ngay sau khi gọi `requestPermission()`, KHÔNG đợi permission thực sự được cấp — permission được cấp bất đồng bộ qua broadcast, và `openConnection()` ở lần `printRawData()` kế tiếp mới thực sự cần permission. Đây là hành vi hiện có, refactor **không sửa** timing này.
- `keepConnection=true` trong `printRawData` (USB) cố tình không đóng kết nối giữa các lần gọi liên tiếp — dùng cho chunk lớn (vd cài font TrueType ~145KB) cần bulk-transfer liên tục trên 1 connection. Transport mới phải giữ nguyên tối ưu này.
- Không có Bluetooth runtime permission check trong Java hiện tại (không có `IBluetoothPermission` cần thiết).
- Không có Java unit test nào hiện tại.

## 3. Quyết định thiết kế (đã chốt với user)

1. **Phạm vi**: sửa cả native Android lẫn JS bridge (không giới hạn chỉ Java).
2. **3 API chết bị xoá hẳn**: `printImageData`, `printQrCode`, `printImageBase64` — xoá khỏi Java (module, adapter, interface) và mọi code chỉ phục vụ chúng.
3. **Gộp 3 native module thành 1 `ThermalPrinterModule`** (tên RN export duy nhất, thay cho `RNUSBPrinter`/`RNBLEPrinter`/`RNNetPrinter`).

## 4. Target Architecture

Áp dụng theo layering đã brainstorm cùng user (tài liệu tham chiếu đầy đủ: kiến trúc do user cung cấp, xem phần "NDTCore POS — Native Android Printer Architecture" — giữ nguyên các nguyên tắc §3, §4, §7-§29, §36-§49 của tài liệu đó, đặc biệt:

- Native không biết ESC/POS/TSPL/Receipt/Label — chỉ nhận `PrinterConnection` + `PrinterData` (raw bytes).
- `Callback` (React Native) chỉ tồn tại ở `ThermalPrinterModule`. Từ `PrinterService` trở xuống dùng `return Result` / `throw PrinterException`.
- Dependency chỉ đi một chiều: `ThermalPrinterModule → PrinterService → TransportResolver → IPrinterTransport → concrete Transport → Android API`.
- Logging: Android `Log` trực tiếp, không tạo `PrinterLogger`; không log raw bytes/base64/content, chỉ log `bytes=`, `durationMs=`, `result=`. Đo duration bằng `SystemClock.elapsedRealtime()`.
- Error: taxonomy `PrinterErrorCode` (chỉ giữ code thực sự cần dùng trong implementation — không cần bê nguyên toàn bộ danh sách mẫu ở §18 nếu implementation không phát sinh case đó), map về `PrinterException`, không leak Android exception ra RN.

### 4.1 Package structure (dưới `com.ndtcorepos.thermalprinter`)

```
thermalprinter/
├── module/
│   ├── ThermalPrinterModule.java      # RN bridge — Callback boundary duy nhất
│   └── ThermalPrinterPackage.java     # thay RNPrinterPackage, đăng ký 1 module
├── application/
│   ├── PrinterService.java
│   └── TransportResolver.java
├── model/
│   ├── PrinterConnection.java         # usb(deviceId) / bluetooth(deviceId) / lan(host,port)
│   ├── PrinterData.java
│   ├── PrinterDevice.java
│   └── PrinterDeviceId.java
├── enum/
│   ├── ConnectionType.java            # USB, BLUETOOTH, LAN
│   └── PrinterOperation.java          # DISCOVER, CHECK_PERMISSION, REQUEST_PERMISSION, CONNECT, WRITE, DISCONNECT
├── discovery/
│   ├── IPrinterDiscovery.java
│   ├── usb/UsbPrinterDiscovery.java
│   └── bluetooth/BluetoothPrinterDiscovery.java
├── permission/
│   ├── IUsbPermission.java
│   └── UsbPermission.java
├── transport/
│   ├── IPrinterTransport.java
│   ├── usb/UsbPrinterTransport.java
│   ├── bluetooth/BluetoothPrinterTransport.java
│   └── network/NetworkPrinterTransport.java
├── error/
│   ├── PrinterErrorCode.java
│   ├── PrinterException.java
│   └── (subclass exceptions theo nhu cầu implementation thực tế)
└── constants/
    └── PrinterConstants.java          # (+ Usb/Bluetooth/Network nếu cần tách)
```

File cũ bị xoá toàn bộ sau khi migrate xong: `RNBLEPrinterModule.java`, `RNNetPrinterModule.java`, `RNUSBPrinterModule.java`, `RNPrinterModule.java`, `RNPrinterPackage.java`, cả thư mục `adapter/`.

### 4.2 Public RN contract (đã điều chỉnh so với tài liệu gốc — xem §3 mục "Existing Public API" của tài liệu tham chiếu vốn liệt kê thiếu/sai)

`ThermalPrinterModule` (`getName() = "ThermalPrinterModule"`) export:

```java
void init(Callback successCallback, Callback errorCallback);

void getDeviceList(String connectionType, Callback successCallback, Callback errorCallback);
// connectionType: "usb" | "bluetooth"  (LAN không discovery, giữ nguyên hiện trạng)

void connectPrinter(ReadableMap connection, Callback successCallback, Callback errorCallback);
// connection = { type: "usb", vendorId, productId }
//            | { type: "bluetooth", innerAddress }
//            | { type: "lan", host, port }

void closeConn(String connectionType);

void printRawData(ReadableMap connection, String base64Data, Boolean keepConnection,
                   Callback successCallback, Callback errorCallback);
```

`printImageData`, `printQrCode`, `printImageBase64` — **không export**.

### 4.3 JS bridge changes

`PrinterNativeModule.ts` (và mọi call site: `UsbTransport.ts`, `NativeAdapter.ts`, `useConnectionSetup.ts`, `PrinterResolver.ts`):

- Đổi `NativeModules.RNUSBPrinter/RNBLEPrinter/RNNetPrinter` → `NativeModules.ThermalPrinterModule` duy nhất.
- 3 namespace `USBPrinter`/`BLEPrinter`/`NetPrinter` hiện có (public export, dùng ở nhiều nơi trong `src/features/printer`) **giữ nguyên làm JS-level namespace** để không phải sửa toàn bộ call site — chỉ đổi implementation bên trong mỗi namespace để gọi `ThermalPrinterModule` với `connection` map tương ứng thay vì gọi module riêng. Đây là ranh giới tương đương "existing public API ổn định" ở phía JS, giống nguyên tắc native ở tài liệu gốc.
- Cập nhật test: `PrinterNativeModule.test.ts`, `NativeAdapter.test.ts`, `UsbTransport.test.ts` (mock `NativeModules.ThermalPrinterModule` thay vì 3 module riêng).

## 5. Behavior phải giữ nguyên (không phải cơ hội "tiện sửa luôn")

- Timing permission USB bất đồng bộ (mục 2, hàng "USB permission").
- `keepConnection` giữ session bulk-transfer USB liên tục qua nhiều lần `printRawData`.
- `printText` (ESC/POS) trên iOS vẫn đi qua path riêng không đổi (`textPreprocessingIOS`) — refactor này chỉ chạm Android, không đổi iOS.
- Hành vi discovery: USB liệt kê qua bulk-OUT endpoint check (`isPrintableUsbDevice`/`findBulkOutInterface`), BLE liệt kê paired devices — logic phát hiện thiết bị giữ nguyên, chỉ đổi vị trí (chuyển vào `UsbPrinterDiscovery`/`BluetoothPrinterDiscovery`).

## 6. Testing / rollout

- Không có Java unit test hiện tại và không thêm test framework mới cho phạm vi này (I/O hardware thật, giá trị test thấp so với chi phí).
- Build: `./gradlew assembleDebug` (hoặc build qua RN CLI) phải pass không lỗi compile.
- Manual verification trên thiết bị thật qua skill `run`: kết nối + in thử cả 3 loại (USB, Bluetooth, LAN), bao gồm case in file lớn qua `keepConnection` (font TrueType) để xác nhận không regress.
- JS: cập nhật + chạy lại 3 file test liệt kê ở §4.3, `npm run type-check`.

## 7. Out of scope

- Không đổi hành vi/protocol (ESC/POS, TSPL) — nằm ở TypeScript driver, không chạm.
- Không sửa timing bug của USB permission flow.
- Không đổi iOS.
- Không thêm LAN discovery (mDNS/broadcast) — vẫn nhập host/port thủ công.
- Không thêm error code nào ngoài những gì implementation thực sự cần để phân biệt case.

## 8. Chuẩn code sạch (acceptance criteria, theo yêu cầu user)

Đây là tiêu chí bắt buộc khi review PR của refactor này, không chỉ là "để package structure đúng là xong":

- **Mỗi file 1 trách nhiệm, đúng ranh giới package ở §4.1** — không tái diễn kiểu `USBPrinterAdapter` 696 dòng gộp discovery + permission + connect + write + image rendering. Nếu 1 class vượt quá 1 trách nhiệm rõ ràng khi implement, đó là dấu hiệu thiếu 1 class/layer, không phải chấp nhận cho qua.
- **Xoá sạch, không giữ song song "để phòng hờ"**: `adapter/`, `RNBLEPrinterModule.java`, `RNNetPrinterModule.java`, `RNUSBPrinterModule.java`, `RNPrinterModule.java`, `RNPrinterPackage.java` phải bị xoá hẳn sau khi migrate xong — không comment-out, không đổi tên thành `*.old.java`, không để cả 2 kiến trúc cùng tồn tại quá 1 PR.
- **Comment chỉ khi WHY không rõ** (theo quy ước gốc của repo) — giữ lại các comment giải thích hành vi đặc biệt đã ghi nhận ở §5 (`keepConnection`, timing permission USB) vì đó là WHY thật sự không hiển nhiên; không viết comment tả lại WHAT code đã tự nói rõ qua tên hàm/biến.
- **Không unused import/field/method** — biên dịch không warning thừa; xoá luôn code chết được liệt kê ở §2 (UtilsImage, zxing QR encode, getBitmapFromURL, các block bulk-transfer ảnh lặp lại) chứ không chỉ ngừng gọi tới chúng.
- **Đặt tên đúng vai trò kiến trúc** (`*Transport`, `*Discovery`, `*Permission`, `*Exception`, `*Resolver`) — tránh tên mơ hồ kiểu `Utils`/`Helper`/`Manager` cho logic nghiệp vụ cụ thể của layer đó.
- **`PrinterErrorCode` tối giản** — chỉ chứa case implementation thực sự phát sinh và cần phân biệt (nhắc lại từ §7, vì đây là lỗi thường gặp nhất khi copy taxonomy mẫu từ tài liệu tham chiếu).
- **Không tạo abstraction/interface không có giá trị kiến trúc hoặc test** (`IPrinterTransport`, `IPrinterDiscovery`, `IUsbPermission` có giá trị vì có nhiều implementation theo connection type — không nhân rộng pattern này cho chỗ chỉ có 1 implementation duy nhất).

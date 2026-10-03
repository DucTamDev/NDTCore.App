# NDTCore POS — Printer Architecture

# 1. Mục tiêu

Printer feature được thiết kế cho production Android POS với các mục tiêu:

* Readability.
* Single Responsibility.
* Explicit dependency direction.
* Dễ test.
* Dễ thêm ngôn ngữ in và loại kết nối.
* Cô lập Android/vendor SDK khỏi business logic.
* Hỗ trợ nhiều printer trong cùng POS, kể cả nhiều máy cùng loại kết nối kết nối cùng lúc.
* Hỗ trợ một máy in vật lý phục vụ nhiều loại nội dung (Hoá đơn + Tem) qua nhiều `Printer` record độc lập, cùng
  `deviceId`.
* Không tạo abstraction nếu abstraction không mang lại boundary hoặc responsibility thực sự.

Nguyên tắc cốt lõi:

> Code dễ đọc trước, code ngắn sau.

> Tên rõ ràng trước, comment sau.

> Comment để giải thích WHY, business rule, constraint và limitation.

> Mỗi function/class chỉ có một responsibility chính.

> Abstraction phải làm code dễ hiểu hơn.

---

# 2. Architecture Overview

Feature có hai luồng chính. Ngôn ngữ in (ESC/POS, TSPL) chỉ encode nội dung thành byte; tìm thiết bị, kết nối, trạng
thái và gửi byte nằm ở **một tầng kết nối chung**, không phân theo ngôn ngữ. Chỗ ghép hai thứ là `printing/` và
`detection/`.

Luồng in:

```text
PrintService
    ↓
PrintRoutingService           chọn máy theo kind
    ↓
PrintScheduler                khoá theo máy vật lý
    ↓
PrinterPrintService           encode theo ngôn ngữ + gửi qua kết nối
    ↓                ↓
IPrintLanguage   PrinterConnectionService
                     ↓
                 IPrinterAdapter (NativeAdapter)
                     ↓
                 DeviceModule (native Android)
```

Luồng thêm máy in:

```text
DeviceDiscoveryService        tìm thiết bị → DiscoveredDevice
    ↓
LanguageDetectionService      kết nối một lần, thử lệnh dò từng ngôn ngữ
    ↓
createPrinterDraft            mặc định theo ngôn ngữ
    ↓
PrinterRepository             lưu
```

| Component                  | Responsibility                                            |
| -------------------------- | --------------------------------------------------------- |
| `PrintService`             | Public API cho print operation                            |
| `PrintRoutingService`      | Xác định printer nào nhận document theo `kind`            |
| `PrintScheduler`           | Queue, ordering, khoá theo máy vật lý                      |
| `PrinterPrintService`      | In / in thử một printer: encode rồi gửi                   |
| `IPrintLanguage`           | Encode nội dung thành byte theo một ngôn ngữ lệnh          |
| `PrinterConnectionService` | Phiên kết nối theo `printerId`: mở, đóng, gửi, đọc, trạng thái |
| `PrinterConnectionLock`    | Khoá loại trừ theo máy vật lý                              |
| `IPrinterAdapter`          | Một kết nối qua một cơ chế (native module, SDK hãng)       |
| `DeviceDiscoveryService`   | Tìm thiết bị cho người dùng chọn                          |
| `LanguageDetectionService` | Dò ngôn ngữ của máy in mới                                |
| `PrinterConfigService`     | Sửa cấu hình in của máy đã lưu                            |
| `PrinterRepository`        | Persistence boundary                                      |
| `PrinterStorage`           | MMKV implementation                                       |
| `PrinterPermissionService` | Platform permission                                       |
| `PrinterLogger`            | Structured logging                                        |

Không đưa responsibility của một layer sang layer khác chỉ để giảm số lượng file.

---

# 3. Feature Structure

```text
src/features/printer/
├── ARCHITECTURE.md
├── CODING_STYLE.md
│
├── models/
│   ├── device/          DeviceInfo, DiscoveredDevice, DeviceDiscoveryEvent — dùng lúc tìm thiết bị, không lưu
│   ├── printer/         Printer, PrintKind, ConnectionType, PrinterConnection (+ deviceIdOf),
│   │                    PrinterLanguage, PrinterCapabilities, PrinterStatus — lưu xuống bộ nhớ
│   ├── paper/           PaperOptions (+ resolveEffectiveCutterMode), paperSpec (thông số theo khổ giấy)
│   └── printing/        PrintDocument, PrintDocuments, PrintOptions, PrintJob
│
├── languages/
│   ├── index.ts         barrel: getPrintLanguage, EscPosLanguage, TsplLanguage, IPrintLanguage
│   ├── IPrintLanguage.ts
│   ├── escpos/          EscPosLanguage, EscPosTextBuilder, EscPosRasterEncoder, EPToolkit
│   └── tspl/            TsplLanguage, TsplEncoder, TsplCommandEncoder, TsplRasterEncoder
│
├── adapters/
│   ├── IPrinterAdapter.ts
│   ├── native/          NativeAdapter (+ toPrinterError), DeviceModule, NativeConnectionPool
│   └── vendor/          VendorAdapter (khung)
│
├── connection/
│   ├── PrinterAdapterFactory.ts / .web.ts   createPrinterAdapter theo nền tảng
│   ├── PrinterConnectionService.ts
│   └── PrinterConnectionLock.ts
│
├── discovery/           DeviceDiscoveryService, NetworkInfoService
├── detection/           LanguageDetectionService
├── printing/            PrintService, PrintRoutingService, PrintScheduler, PrinterPrintService
├── management/          PrinterConfigService, createPrinterDraft
├── permissions/         PrinterPermissionService
├── storage/             PrinterRepository, PrinterStorage, PrinterWriteInput
├── rendering/           render document → ảnh (Raster)
├── logging/             PrinterLogger
├── errors/              PrinterError
│
├── components/
├── hooks/
├── forms/               schema, PaperDraft (+ validation giấy), printerRules (canPrintKind)
├── store/
├── utils/
│
└── testing/             printerFixtures, printerServiceTestKit, encodeCases
```

## Structure Rules

* `models/` chỉ chứa dữ liệu và hàm thuần suy ra từ dữ liệu (vd `deviceIdOf`); không chứa nhãn UI, không import từ
  `languages/`, `connection/`, `printing/`, `components/`.
* `languages/` chỉ encode; không biết kết nối.
* `adapters/` chứa integration với native module / SDK hãng; không chứa business rule.
* `connection/` quản lý phiên kết nối và khoá; không biết ngôn ngữ in.
* `discovery/` tìm thiết bị; `detection/` dò ngôn ngữ.
* `printing/` ghép ngôn ngữ với kết nối để in.
* `storage/` chứa persistence boundary.
* `permissions/` chứa platform permission.
* `management/` chứa cấu hình máy in và giá trị mặc định khi tạo máy mới.
* `logging/` chứa structured logging; `errors/` chứa printer-specific errors.

Không tạo thêm folder chỉ vì muốn "đủ layer".

---

# 4. Core Domain Model

Các trục độc lập, không map cứng `Receipt → ESC/POS`, `Label → TSPL`:

```text
PrintKind        Receipt | Label            loại nội dung một Printer record in
PrintLanguage    EscPos | Tspl              ngôn ngữ lệnh của máy
ConnectionType   Usb | Bluetooth | Lan      đường kết nối
RenderMode       Command | Raster           cách biến nội dung thành lệnh
```

Quy ước chung: const-object + type cùng tên (không dùng `enum`); mỗi model một file; summary tiếng Việt cho model và
field cần giải thích.

Ràng buộc duy nhất giữa ngôn ngữ và loại nội dung là `canPrintKind(language, kind)`
(`forms/addPrinter/printerRules.ts`): ESC/POS chỉ in `Receipt`; TSPL in cả hai.
Schema, dò ngôn ngữ và UI chọn ngôn ngữ tay cùng dùng hàm này.

---

# 5. Printer Model

Một `Printer` là cấu hình atomic: ĐÚNG 1 `connection` + ĐÚNG 1 `language` + ĐÚNG 1 `paper` + ĐÚNG 1 `kind`.

```ts
export interface Printer {
  id: string;
  deviceId: string;
  kind: PrintKind;
  name: string;
  vendor?: string;
  model?: string;
  connection: PrinterConnection;
  language: PrinterLanguage;
  paper: PaperOptions;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Field rules

* `id` sinh khi tạo, không đổi khi sửa. Phiên kết nối và trạng thái được giữ theo `id`.
* `deviceId` = `deviceIdOf(connection)` — định danh máy vật lý (§6). `PrinterRepository` tự tính lại, không tin caller.
* `kind` cố định cho record này. Một máy in vật lý phục vụ cả Hoá đơn lẫn Tem được biểu diễn bằng **2 `Printer`
  record** cùng `deviceId`, khác `kind`. Unique theo cặp (`deviceId`, `kind`).
* `language` (§8), `paper` (§11), `capabilities` (§9).
* Không có `isDefault`.

---

# 6. `deviceId` và khoá in

```ts
deviceIdOf(connection: PrinterConnection): string
```

| Kết nối   | `deviceId`                                    |
| --------- | --------------------------------------------- |
| LAN       | `lan:<host>:<port>`                           |
| Bluetooth | `bluetooth:mac:<MAC viết hoa>`                |
| USB       | `usb:<vendorId>:<productId>[:<serialNumber>]` |

USB chỉ có serial sau khi người dùng cấp quyền; không có serial thì không phân biệt được hai máy cùng model.

`deviceId` dùng cho hai việc:

* chống thêm trùng (cặp `deviceId` + `kind`);
* khoá in: `lockKeyOf(printer)` = `deviceIdOf(printer.connection)` — cùng máy vật lý thì in lần lượt, máy khác nhau in
  song song. Tính từ kết nối để bản nháp chưa lưu cũng khoá đúng máy.

**Không bao giờ** so `Printer.deviceId` với `DeviceInfo.deviceId` (§10): muốn biết một kết quả quét có phải máy đã lưu
thì so `printer.deviceId === deviceIdOf(discovered.connection)`.

---

# 7. Printer Connection

Discriminated union theo `type`, đủ để kết nối lại mà không cần quét:

```ts
UsbPrinterConnection        { type: Usb; vendorId; productId; serialNumber? }
BluetoothPrinterConnection  { type: Bluetooth; mac }
LanPrinterConnection        { type: Lan; host; port }
```

Không lưu đường dẫn thiết bị USB (chỉ đúng trong một lần cắm).

---

# 8. Printer Language

```ts
export interface PrinterLanguage {
  type: PrintLanguage;           // EscPos | Tspl
  selection: LanguageSelection;  // Auto (dò) | Manual (người dùng chọn) — chỉ để hiển thị
  renderMode: RenderMode;        // Command | Raster
  rasterSource: RasterSource;    // Image | Ast — chỉ có tác dụng khi Raster
}
```

Giá trị mặc định khi tạo máy mới nằm ở `management/PrinterDefaults.ts` (`createPrinterLanguage`,
`createPrinterDraft`):

| Field          | ESC/POS   | TSPL     |
| -------------- | --------- | -------- |
| `renderMode`   | `Command` | `Raster` |
| `rasterSource` | `Image`   | `Image`  |

---

# 9. Printer Capabilities

```ts
export interface PrinterCapabilities {
  cutter: boolean;
  cashDrawer: boolean;
  color: boolean;
  image: boolean;
}
```

Mô tả phần cứng; hiện chỉ khai báo, chưa chặn hành vi in. Mặc định theo ngôn ngữ (`createPrinterDraft`): ESC/POS
`{ cutter, cashDrawer, image }`, TSPL `{ image }`.

Không merge với `PaperOptions`:

```text
PaperOptions         → Job muốn in như thế nào?
PrinterCapabilities  → Máy thực tế có khả năng gì?
```

---

# 10. Device Models

`models/device/` dùng lúc tìm thiết bị, không lưu.

```ts
/** Thông tin cơ bản của một thiết bị tìm thấy khi quét. */
interface DeviceInfo {
  deviceId: string;        // mã quét của native trong lần discovery hiện tại; key danh sách
  name: string;            // native không có thì dùng MAC hoặc đường dẫn thiết bị
  manufacturer?: string;   // chỉ USB
  model?: string;          // chỉ USB
  hasPermission: boolean;  // quét không mở hộp thoại xin quyền
}

/** Một kết quả quét: thiết bị và cách kết nối tới nó. */
interface DiscoveredDevice {
  device: DeviceInfo;
  connection: PrinterConnection;  // chọn máy thì gán thẳng vào Printer.connection
}

type DeviceDiscoveryEvent = Loading | Found { devices } | Empty | Error { error };
```

`DeviceInfo.deviceId` của USB chứa đường dẫn thiết bị nên đổi khi rút ra cắm lại; luồng thêm máy dùng nó để quét lại và
lấy serial sau khi được cấp quyền.

---

# 11. Paper Options

```ts
type PaperOptions = ContinuousPaper | DieCutPaper;

ContinuousPaper  { type: Continuous; paperSize; cutterMode }
DieCutPaper      { type: DieCut; paperSize; itemWidthMm; itemHeightMm; columns; horizontalGapMm; verticalGapMm }
```

Union theo `type` để trạng thái vô nghĩa không biểu diễn được (giấy cuộn không có kích thước tem; tem không có dao cắt).
Form dùng `PaperDraft` (`forms/addPrinter/PaperDraft.ts`) — các field tem có thể còn trống; `toPaperOptions` chỉ trả
`PaperOptions` khi đủ và hợp lệ.

`PaperOptions` dùng cho layout, paper calculation, die-cut positioning, cutter behavior. Không dùng để biểu diễn
capability phần cứng.

---

# 12. Paper Rules

* Giấy cuộn: `cutterMode` bắt buộc; mặc định khi tạo máy `PerJob`.
* Tem rời: không cắt (`resolveEffectiveCutterMode` trả `None`).
* ESC/POS chỉ giấy cuộn (schema chặn).
* Tem rời nhiều cột:

```text
rowWidth = columns × itemWidthMm + (columns - 1) × horizontalGapMm
rowWidth > printableWidth → cấu hình không hợp lệ
```

Rule nằm ở `forms/addPrinter/PaperDraft.ts` (`dieCutMediaError`, `dieCutRowOverflow`); schema gắn `superRefine` lên
union.

---

# 13. Paper Module

```text
models/paper/
├── PaperOptions.ts     ContinuousPaper | DieCutPaper, PaperSize, CutterMode,
│                       resolveEffectiveCutterMode (DieCut → None, Continuous → paper.cutterMode)
└── paperSpec.ts        thông số theo khổ: vùng in, ký tự/dòng, bề rộng ảnh, trần chiều cao giấy cuộn

forms/addPrinter/
└── PaperDraft.ts       bản nháp form (field tem có thể trống), toPaperOptions,
                        dieCutMediaError / dieCutRowOverflow (thiếu kích thước tem, hàng tem tràn khổ)
```

`paperSpec` và cách cắt là dữ liệu và hàm thuần của giấy nên nằm trong model. Validation nhận bản nháp nên nằm cạnh
form; schema và repository gọi lại cùng hàm, không phân tán vào nhiều layer.

---

# 14. Rendering

`RenderMode` dùng chung cho cả hai ngôn ngữ, nằm trong `PrinterLanguage`.

## `Command`

Ngôn ngữ tạo lệnh văn bản trực tiếp. ESC/POS qua `EscPosTextBuilder` + `EPToolkit` (cần đúng codepage); TSPL qua
`encodeTsplCommand` (font máy, thường thiếu dấu tiếng Việt).

## `Raster`

Nội dung đã render thành ảnh (PNG base64, `documents.image`) ở lớp trên — theo `rasterSource`: `Image` chụp bản xem
trước, `Ast` vẽ thẳng từ `PrintDocument`. Ngôn ngữ decode ảnh thành monochrome 1-bit rồi gửi lệnh ảnh của mình
(`GS v 0` cho ESC/POS, `BITMAP` cho TSPL). Chậm hơn `Command` nhưng đúng trên mọi máy bất kể codepage.

---

# 15. Text Rendering Rules

Protocol codepage và font rendering là hai vấn đề khác nhau.

Nếu text đã được rasterize thành ảnh:

```text
Unicode text → font Unicode → bitmap → ESC/POS / TSPL
```

thì ngôn ngữ in không còn chịu trách nhiệm encode Unicode text — "Nước" in đúng dù máy TSPL không có codepage tiếng
Việt.

---

# 16. Print Languages

```ts
/** Một ngôn ngữ lệnh máy in: chỉ biến nội dung thành byte, không biết kết nối. */
interface IPrintLanguage {
  encode(printer: Printer, documents: PrintDocuments, options?: PrintOptions): Uint8Array;
  identifyProbe?: IdentifyProbe;   // { command: Uint8Array; matches(response): boolean }
}

getPrintLanguage(type: PrintLanguage): IPrintLanguage
```

* `encode` kiểm tra rồi encode; nội dung không in được (thiếu ảnh, ảnh quá cao, phần tử không hỗ trợ) ném
  `PrinterErrorException`.
* `EscPosLanguage`: `Command` → `EscPosTextBuilder` + `EPToolkit`, bỏ tiền tố khởi tạo mà `EPToolkit` luôn thêm, cắt
  giấy theo `resolveEffectiveCutterMode`; `Raster` → `EscPosRasterEncoder` (`IMAGE_REQUIRED`, `IMAGE_INVALID`,
  `IMAGE_TOO_LARGE`). Không có lệnh dò.
* `TsplLanguage`: theo `renderMode` gọi `encodeTsplCommand` hoặc `encodeTsplRaster` (tự kiểm tra ảnh rồi encode);
  `rows` = `options.rows` (không hợp lệ thì 1). Lệnh dò `~!T\r\n`, khớp khi máy trả lời ít nhất 1 byte.
* Byte encode được ghim bằng fixture (`testing/encodeCases.ts`): mọi thay đổi encoder phải giữ nguyên dấu vân tay hoặc
  cập nhật fixture có chủ đích.

Thêm ngôn ngữ mới: thêm giá trị `PrintLanguage`, một `IPrintLanguage`, nhánh trong `getPrintLanguage`, quy tắc trong
`canPrintKind` và mặc định trong `createPrinterDraft`.

---

# 17. Adapter Layer

```ts
interface IPrinterAdapter {
  readonly source: 'native' | 'vendor';
  readonly canRead: boolean;
  listDevices(connectionType): Promise<DiscoveredDevice[]>;
  connect(connection: PrinterConnection): Promise<void>;   // mở được rồi mới trả kết nối cũ
  write(bytes: Uint8Array): Promise<void>;
  read(timeoutMs): Promise<Uint8Array | null>;            // null khi hết hạn
  onLost(callback): Unsubscribe;                           // kết nối của chính instance này mất
  disconnect(): Promise<void>;
}
```

* Mỗi instance giữ tối đa một kết nối.
* `NativeAdapter` dùng cho USB, Bluetooth và LAN qua native module `DeviceModule`. Kết nối dùng chung qua
  `NativeConnectionPool`: hai `Printer` cùng một thiết bị chỉ mở một kết nối native, đóng khi printer cuối cùng ngắt.
  `onLost` nghe `DeviceDisconnected` và so `connectionId` của kết nối đang giữ.
* `VendorAdapter` là khung cho SDK hãng, chưa tích hợp.
* `createPrinterAdapter` (`connection/PrinterAdapterFactory.ts`) trả `NativeAdapter`; bản `.web.ts` trả adapter báo
  `PRINTER_UNSUPPORTED_CONNECTION`.

Không đưa business rule vào adapter.

---

# 18. Native Boundary

Native Android code nằm dưới `adapters/native/` (TS) và module `DeviceModule` (Java). Không tạo top-level `native/`.

Native chịu trách nhiệm USB / Bluetooth / socket API, chuyển đổi byte và vòng đời kết nối native. TypeScript business
code không trực tiếp sử dụng Android API, kể cả UI: muốn quét thì đi qua `createPrinterAdapter().listDevices`.

---

# 19. Native API Comment Rule

Không comment mọi function chỉ vì function sử dụng Android API.

Chỉ comment khi behavior hoặc constraint không hiển nhiên.

Ví dụ phù hợp:

```java
// Android USB permission is associated with the physical UsbDevice,
// so permission must be checked against the exact device before opening it.
```

Không cần:

```java
// Get UsbManager.
UsbManager manager = ...
```

Comment cần giải thích:

* Android-specific limitation;
* lifecycle constraint;
* permission behavior;
* vendor SDK quirk;
* non-obvious workaround;
* concurrency limitation.

---

# 20. Connection Service

`PrinterConnectionService` giữ phiên kết nối theo `printerId` — dùng cho cả máy đã lưu lẫn bản nháp đang thêm.

| Hàm | Làm gì |
| --- | --- |
| `connect(printer)` | Mở kết nối bằng adapter mới, `Connecting` → `Connected` / `Error` (chi tiết dưới bảng) |
| `disconnect(printerId)` | `Disconnecting` → trả adapter → `Disconnected`; chưa kết nối thì chỉ đặt `Disconnected` |
| `send(printerId, bytes)` | Ghi qua adapter của phiên; chưa kết nối → `PRINTER_NOT_CONNECTED` |
| `read(printerId, timeoutMs)` | Đọc phản hồi; `null` khi hết hạn |
| `getStatus` / `onStatusChange` | Theo phiên trong bộ nhớ; chưa từng kết nối là `Idle` |
| `reconnect(printerId)`, `reconnectAutoPrinters()` | Đọc máy in đã lưu từ `PrinterRepository` |

* `connect`: Bluetooth thì xin quyền trước. Thành công mới thay phiên cũ rồi trả adapter cũ (lỗi khi trả chỉ ghi
  log); thất bại thì phiên cũ giữ nguyên.
* Adapter báo `onLost` → `Disconnected` (adapter đã bị thay thì bỏ qua).
* Không giới hạn số máy cùng loại kết nối kết nối cùng lúc.
* Không biết ngôn ngữ in; log kết nối không mang ngôn ngữ.
* **Không tự khoá**: `PrinterPrintService.print` kết nối bên trong khoá của scheduler, khoá lại sẽ treo.

Không chịu trách nhiệm `print`, `route`, `schedule`, `render`, `encode`, `save`.

---

# 21. PrinterConnectionLock

```ts
lockKeyOf(printer)       = deviceIdOf(printer.connection)
createResourceLock()     → { runExclusive(key, task) }
PrinterConnectionLock    singleton dùng chung
```

Một lệnh in gồm nhiều lần gọi native; native chỉ giữ thứ tự từng lần gọi chứ không giữ trọn cả lệnh in, nên hai lệnh
in cùng một máy phải chạy lần lượt. Hàng đợi in (`PrintScheduler`) và nút "In thử" (`PrinterPrintService.testPrint`)
dùng chung một khoá. Khoá không reentrant.

Không log key: key là `deviceId`, nhúng IP/MAC.

---

# 22. Printing Services

## `PrintService`

Public entry point. Dựng `PrintDocuments` (ảnh theo `renderMode`/`rasterSource` của từng máy), gọi routing và
scheduler, tổng hợp kết quả. Không chứa device discovery, connection lifecycle, encoding.

## `PrintRoutingService`

Chọn máy nhận theo `printer.kind` và `enabled`.

## `PrintScheduler`

Queue, ordering, job lifecycle. Khoá theo `lockKeyOf(printer)` (máy không còn trong danh sách thì khoá theo
`printerId`). Không biết lệnh ESC/POS hay TSPL.

## `PrinterPrintService`

```text
print(printerId, documents, options?)
  lấy Printer → chưa Connected thì connect → getPrintLanguage(type).encode → send
testPrint(printer, documents, options?)
  như trên, máy có thể chưa lưu; tự khoá theo máy vật lý
```

`print` không tự khoá (luôn được scheduler gọi bên trong khoá). Ghi log `print*` / `testPrint*` kèm ngôn ngữ.

---

# 23. Complete Print Flow

```text
PrintService
    ↓
PrintRoutingService → target printers (mỗi target một job)
    ↓
PrintScheduler → PrinterConnectionLock(lockKeyOf(printer))
    ↓
PrinterPrintService
    ├── PrinterConnectionService.connect (nếu chưa Connected)
    ├── IPrintLanguage.encode
    └── PrinterConnectionService.send → NativeAdapter → DeviceModule
```

Máy khác nhau in song song; hai record cùng máy vật lý in lần lượt.

---

# 24. Print Failure Policy

POS print failure không được làm crash sales flow một cách không cần thiết.

Public receipt printing không throw error ra UI flow nếu application policy yêu cầu best-effort printing. Lower-level
layers vẫn trả structured error:

```text
Native / adapter error (PrinterErrorException)
    ↓
PrinterPrintService (log print* failed)
    ↓
PrintScheduler (job Failed + PrinterError)
    ↓
Logging / monitoring
```

Không swallow error ở mọi layer. Chỉ public operation quyết định error policy phù hợp với POS flow.

---

# 25. Device Discovery

`DeviceDiscoveryService.discover(connectionType, onEvent): Unsubscribe`

* LAN → `Empty` ngay (người dùng nhập IP; `NetworkInfoService` gợi ý IP WiFi hiện tại).
* Bluetooth → xin quyền rồi `adapter.listDevices` (chỉ máy đã ghép đôi).
* USB → `adapter.listDevices`; quét không mở hộp thoại xin quyền (`hasPermission` cho biết đã có quyền chưa).
* Native báo "No Device Found" bằng lỗi thì coi là rỗng.
* Huỷ thì không báo thêm sự kiện.
* Log `debug` chi tiết thiết bị chỉ trong dev; `PrinterLogger.discovery*` không mang MAC.

---

# 26. Language Detection

`LanguageDetectionService.detect({ draftPrinter }, onEvent): Unsubscribe`

```text
Connecting → (Identifying × mỗi ngôn ngữ thử) → Detected | Unknown | Error
```

* Kết nối bản nháp **một lần** qua `PrinterConnectionService.connect`.
* Thứ tự thử: TSPL, rồi ESC/POS — lọc bằng `canPrintKind(language, draftPrinter.kind)`.
* Ngôn ngữ có `identifyProbe` → `send` lệnh dò, `read` trong 1 giây; `matches` → `Detected`. Gửi lỗi coi như không khớp.
* ESC/POS không có lệnh dò → `Detected` khi đã kết nối và đường truyền không phải USB ("xác nhận yếu"). USB không bao
  giờ tự xác nhận ESC/POS vì kết nối USB thành công với mọi máy.
* `Detected` trả `PrinterLanguage` dựng bằng `createPrinterLanguage(type, Auto)`; kết nối được giữ lại cho in thử.
* Không ngôn ngữ nào khớp → ngắt kết nối, `Unknown` (UI cho chọn tay). Kết nối thất bại → `Error`.
* Huỷ giữa chừng → ngắt kết nối, không báo thêm sự kiện.

---

# 27. Printer Add Flow

```text
Chọn loại kết nối
    ↓
Chọn thiết bị (DiscoveredDeviceList) / nhập IP + port
    ↓
deviceIdOf(connection) → cảnh báo trùng (deviceId + kind)
    ↓
Kết nối + dò ngôn ngữ (useLanguageDetection) — hoặc chọn ngôn ngữ tay
    ↓
USB: quét lại theo DeviceInfo.deviceId để lấy serial (refreshUsbSerial)
    ↓
Chỉnh giấy, cách render (usePrintSettings) → In thử
    ↓
Lưu (createPrinterDraft + giá trị người dùng chỉnh)
```

Identity check phải xảy ra trước khi lưu. Hook `useAddPrinterFlow` điều phối `useConnectionSetup`,
`useLanguageDetection`, `useTestPrint`, `usePrintSettings`.

---

# 28. Permissions

`permissions/PrinterPermissionService.ts` chỉ xử lý platform permission. Quyền Bluetooth được xin ở
`DeviceDiscoveryService` (trước khi quét) và `PrinterConnectionService` (trước khi kết nối) — hai nơi chạm platform
boundary. Không đưa permission checking vào ngôn ngữ in hay `PrintService`.

---

# 29. Configuration Management

* `management/PrinterConfigService.ts`: sửa cấu hình in của máy đã lưu (`setRenderMode`, `setRasterSource`,
  `setPaper`).
* `management/PrinterDefaults.ts`: `createPrinterDraft({ id?, kind, connection, language })` — máy in mới với mọi
  giá trị mặc định (giấy cuộn 80mm cắt cuối job, render mode và capabilities theo ngôn ngữ, `autoReconnect` bật).
  Mọi nơi tạo máy in dùng hàm này.
* `forms/addPrinter/printerRules.ts`: `canPrintKind`.

Không chịu trách nhiệm physical discovery, actual printing, queue.

---

# 30. Storage

```text
storage/
├── PrinterRepository.ts   persistence boundary: tính lại deviceId, chống trùng (deviceId + kind), validate schema
├── PrinterStorage.ts      MMKV implementation + storage version
└── PrinterWriteInput.ts   input ghi: như Printer nhưng deviceId chỉ là đề xuất
```

Storage implementation không được leak ra domain layer.

## Storage Versioning

`printer.storageVersion` hiện là **8**. Khi data model thay đổi breaking thì bump version; dữ liệu phiên bản khác bị
xoá sạch, người dùng thêm lại máy in (không migrate).

---

# 31. State Management

Redux chỉ lưu serializable configuration/state (`Printer`, trạng thái kết nối). Không lưu adapter, kết nối native,
socket hay SDK instance — runtime objects nằm trong vòng đời của service/adapter.

---

# 32. Logging

`logging/PrinterLogger.ts` — mỗi hàm một event name cố định, chỉ nhận field an toàn (printerId nội bộ, ngôn ngữ,
connectionType, errorCode, durationMs) và kèm `operation` / `result`.

| Operation    | Events |
| ------------ | ------ |
| `discovery`  | `discoveryStarted`, `discoveryCompleted`, `discoveryFailed`, `permissionDenied` |
| `connect` / `disconnect` | `connectSucceeded`, `connectFailed`, `disconnectSucceeded`, `disconnectFailed` |
| `detection`  | `detectionStarted`, `detectionCandidateRejected`, `detectionFailed`, |
|              | `languageDetected`, `languageUnknown` |
| `print` / `test-print` | `printSucceeded`, `printFailed`, `testPrintSucceeded`, `testPrintFailed` |

Không log binary payload, MAC/IP hay nội dung hoá đơn.

---

# 33. Errors

`errors/PrinterError.ts` — printer errors có stable error code (`PrinterErrorCode`), vd `PRINTER_NOT_CONNECTED`,
`PRINTER_CONNECTION_FAILED`, `PRINTER_WRITE_FAILED`, `PRINTER_UNSUPPORTED_CONNECTION`, `IMAGE_REQUIRED`,
`IMAGE_TOO_LARGE`, `TSPL_ELEMENT_UNSUPPORTED`. Native error được đổi sang `PrinterErrorException` ở
`toPrinterError` (`adapters/native/NativeAdapter.ts`).

Error code phục vụ logging, diagnostics, UI mapping, monitoring, testing. Không dùng error message làm machine-readable
identifier.

---

# 34. TypeScript Readability Rules

## 34.1 Main flow phải nhìn thấy được

Ưu tiên:

```ts
const printer = repository.findOrThrow(printerId);

if (connectionService.getStatus(printer.id) !== PrinterStatus.Connected) {
  await connectionService.connect(printer);
}

const bytes = getPrintLanguage(printer.language.type).encode(printer, documents, options);
await connectionService.send(printer.id, bytes);
```

hơn một function wrapper chain khó trace.

---

# 35. Guard Clause

Ưu tiên early return.

Không nên:

```ts
if (printer) {
  if (printer.enabled) {
    if (isConnected) {
      await send(printer, documents);
    }
  }
}
```

Nên:

```ts
if (!printer) {
  return;
}

if (!printer.enabled) {
  return;
}

if (!isConnected) {
  return;
}

await send(printer, documents);
```

Mục tiêu:

```text
nesting <= 2 levels
```

Nếu vượt quá, xem xét refactor.

---

# 36. Function Responsibility

Một function nên có một purpose.

Không tạo function đồng thời:

```text
validate
→ transform
→ API call
→ storage
→ state mutation
→ notification
```

Nếu các responsibility có boundary thực sự, tách chúng.

Nhưng không tạo function chỉ để giảm số dòng.

---

# 37. Class Responsibility

Một class có thể có nhiều methods nếu chúng cùng phục vụ một responsibility.

Ví dụ hợp lệ:

```ts
PrinterConnectionService
├── connect()
├── disconnect()
├── reconnect()
└── getStatus()
```

Vì tất cả đều thuộc:

```text
connection lifecycle
```

Không hợp lệ:

```ts
PrinterManager
├── connect()
├── print()
├── save()
├── discover()
├── sendNotification()
└── generateReport()
```

Không tạo "Manager" class để gom mọi behavior của feature.

---

# 38. Naming

Tên phải thể hiện intent.

Không nên:

```ts
data
result
value
item
obj
temp
response
```

nếu có tên cụ thể hơn.

Nên:

```ts
printer
printJob
requestPayload
availablePrinters
orderTotal
connectionStatus
```

Không dùng comment để giải thích cho tên biến kém rõ.

---

# 39. Condition Naming

Condition phức tạp nên được đặt tên nếu business meaning không rõ.

Ví dụ:

```ts
const canPrintReceipt =
  printer.enabled &&
  printer.kind === PrintKind.Receipt;

if (!canPrintReceipt) {
  return;
}
```

Hoặc:

```ts
if (!canPrintReceipt(printer)) {
  return;
}
```

Tên condition phải phản ánh business intent.

---

# 40. Comments

Comment chỉ tồn tại khi code không thể tự giải thích đầy đủ.

Ưu tiên:

```text
Good naming
→ clear structure
→ small responsibility
→ comment only when necessary
```

Không làm ngược lại:

```text
complex code
→ long comment
```

---

# 41. Field Comment Rules

Comment field khi field có:

* business meaning;
* hidden constraint;
* lifecycle;
* relationship với field khác;
* platform-specific behavior;
* runtime constraint.

Ví dụ:

```ts
interface Printer {
  id: string;
  name: string;

  /**
   * Định danh máy in vật lý, tính từ `connection`; chống thêm trùng
   * và làm khoá để hai lệnh in cùng máy không chạy đồng thời.
   */
  deviceId: string;
}
```

Không viết:

```ts
/** String containing printer ID. */
id: string;
```

---

# 42. Field Invariant

Nếu invariant đơn giản, có thể comment ngay tại field.

Ví dụ:

```ts
interface PaperDraft {
  type: PaperType;

  /**
   * Required when type is DieCut.
   */
  columns?: number;
}
```

Nếu invariant phức tạp:

```text
type
columns
itemWidthMm
horizontalGapMm
paperSize
```

không nên nhét toàn bộ rule vào comments.

Rule phải nằm trong:

```text
forms/addPrinter/PaperDraft.ts
```

---

# 43. Comment WHAT vs WHY

Không nên:

```ts
// Get printer.
const printer = await repository.getById(printerId);
```

Không nên:

```ts
// Check printer.
if (!printer) {
  return;
}
```

Nên:

```ts
// A printer may have been removed while a queued job is waiting.
if (!printer) {
  return;
}
```

Comment này giải thích lý do guard tồn tại.

---

# 44. Business Rule Comment

Có thể comment business rule khi rule không thể hiện rõ từ code.

```ts
// Receipt printing is best-effort so a printer failure does not block checkout completion.
await printReceipt(order);
```

---

# 45. Constraint Comment

```ts
// Một lệnh in gồm nhiều lần gọi native; native chỉ giữ thứ tự từng lần gọi
// nên hai lệnh in cùng một máy phải chạy lần lượt.
await lock.runExclusive(lockKeyOf(printer), () =>
  sendDocuments(printer, documents),
);
```

---

# 46. Workaround Comment

```ts
// XP-420B firmware expects inverted bitmap bits.
// Keep this transformation until firmware behavior is verified across supported models.
invertBitmap(bitmap);
```

Workaround comment phải giải thích:

```text
why
+
when it can be removed
```

nếu thông tin đó thực sự hữu ích.

---

# 47. No Obvious Comments

Không comment:

```ts
count++;
```

Không comment:

```ts
return printer;
```

Không comment:

```ts
await api.getPrinters();
```

Không comment:

```ts
const printer = createPrinter();
```

Code tự giải thích được.

---

# 48. No Comment-Based Complexity

Không dùng comment để hợp thức hóa code khó đọc.

Không nên:

```ts
// Check whether printer can receive receipt jobs.
if (
  printer &&
  printer.enabled &&
  printer.kind === PrintKind.Receipt &&
  printer.language.type === PrintLanguage.EscPos
) {
  ...
}
```

Nên:

```ts
if (!canPrintReceipt(printer)) {
  return;
}
```

Business rule được đặt trong function có tên rõ ràng.

---

# 49. Side Effects

Side effect phải dễ nhận biết.

Các operation sau được xem là side effect:

```text
API call
storage write
database write
state mutation
file write
logging
notification
native call
printer write
```

Không giấu side effect trong function có tên chỉ thể hiện calculation.

Không nên:

```ts
calculateTotal()
```

nhưng bên trong:

```text
calculate
+
save
+
update state
```

Tên function phải phản ánh behavior thật.

---

# 50. Abstraction Rules

Không tạo abstraction chỉ vì muốn architecture "clean".

Không tạo:

```text
BaseManager
AbstractService
GenericHandler
UniversalProcessor
CommonHelper
PrinterManager
GenericRenderer
```

nếu abstraction không tạo ra:

* responsibility boundary;
* reusable behavior;
* meaningful contract;
* testability benefit;
* integration boundary.

---

# 51. No Meaningless Wrapper

Không nên:

```ts
function execute() {
  return process();
}

function process() {
  return handle();
}

function handle() {
  return save();
}
```

Nếu không có responsibility boundary, giữ flow ở nơi caller có thể đọc trực tiếp.

---

# 52. Không Over-Abstraction Printer Architecture

Không tạo:

```text
PrintManager
PrinterManager
PrinterFactory
LanguageFactory
ConnectionFactory
GenericRenderer
GenericPrinterService
```

chỉ để điều phối các class hiện có.

Nếu resolver thực sự có responsibility:

```ts
getPrintLanguage(type)
```

thì giữ resolver.

Nếu một class chỉ forward method:

```ts
manager.print()
→ service.print()
→ handler.print()
```

thì xem xét loại bỏ wrapper.

---

# 53. Dependency Direction

```text
UI (components, hooks)
 ↓
printing / detection / discovery / management
 ↓
languages            connection
                       ↓
                     adapters
                       ↓
                     Native / Vendor SDK
 ↓
models (không phụ thuộc layer nào ở trên)
```

* `languages/` và `connection/` không phụ thuộc nhau.
* Các layer phía trên không phụ thuộc trực tiếp vào Android API.

Không cho phép:

```text
UI → DeviceModule / Native SDK
Language → Connection / Adapter
Connection → Language
Adapter → Redux / MMKV
Storage → React Component
Model → languages / connection / printing / components
```

---

# 54. Testing Structure

```text
testing/
├── printerFixtures.ts        makePrinter, makeEscPosLanguage, makeTsplLanguage
├── printerServiceTestKit.ts  makeFakeAdapter, makeMockConnectionService, basePrinter
└── encodeCases.ts            fixture byte encode + fingerprintOf
```

Test tập trung vào responsibility của component:

```text
IPrintLanguage           → byte encode khớp fixture, lỗi nội dung
PrinterConnectionService → phiên, trạng thái, thay adapter, onLost, nhiều máy song song
LanguageDetectionService → kết nối một lần, lệnh dò, xác nhận yếu, huỷ
DeviceDiscoveryService   → quyền, ánh xạ native → DiscoveredDevice
PrintScheduler           → ordering, khoá theo máy vật lý
PrinterPrintService      → encode + gửi, kết nối khi cần, không tự khoá khi print
PaperDraft               → paper rule tests
```

`printing/__tests__/encodeCases.test.ts` chạy trọn đường in thử (service thật + `DeviceModule` mock) và so dấu vân tay
byte với fixture.

---

# 55. Testing Runtime Concurrency

Test các boundary của khoá:

```text
hai Printer record cùng máy vật lý      → in lần lượt
máy khác nhau, cùng loại kết nối        → in song song
job trong hàng đợi + "In thử" cùng máy  → in lần lượt (chung khoá)
```

---

# 56. Native Binary Contract

```text
IPrintLanguage → Uint8Array → NativeAdapter → Base64 → React Native bridge → Android byte[]
```

Không expose Android `byte[]` trực tiếp lên TypeScript.

---

# 57. Vendor SDK Isolation

Vendor SDK phải được cô lập tại `adapters/vendor/` hoặc `adapters/native/`. Ngôn ngữ in và connection service chỉ biết
contract `IPrinterAdapter`.

```text
PrinterConnectionService → IPrinterAdapter → NativeAdapter / VendorAdapter → SDK
```

---

# 58. Android API Rule

Các class sử dụng Android API (`android.content.Context`, `android.hardware.usb.*`, `android.bluetooth.*`,
`android.net.*`) phải nằm ở native/integration boundary, không leak lên TypeScript domain/service layer.

Comment Android API chỉ thêm khi có behavior không hiển nhiên.

---

# 59. Runtime Object Rule

Không persist hoặc Redux-store runtime object (`UsbDevice`, `UsbDeviceConnection`, `BluetoothSocket`, socket, SDK
instance, adapter instance).

Chỉ lưu serializable configuration: `Printer`, `PrinterConnection`, `PrinterLanguage`, `PrinterCapabilities`,
`PaperOptions`.

---

# 60. Final Architecture Invariants

### Printer

* Không có `isDefault`.
* `deviceId` = `deviceIdOf(connection)`, định danh máy vật lý; repository tự tính lại.
* Mỗi printer có ĐÚNG 1 `language`, ĐÚNG 1 `connection`, ĐÚNG 1 `paper`, ĐÚNG 1 `kind` cố định.
* Một máy vật lý phục vụ nhiều loại nội dung = nhiều `Printer` record cùng `deviceId`, khác `kind`.
* Unique constraint là cặp (`deviceId`, `kind`).
* Không so `Printer.deviceId` với `DeviceInfo.deviceId`.

### Languages

* `EscPos` và `Tspl` là ngôn ngữ độc lập; chỉ encode, không biết kết nối.
* `canPrintKind` là ràng buộc duy nhất giữa ngôn ngữ và loại nội dung.
* Byte encode khớp fixture.

### Connection

* `PrinterConnectionService` giữ phiên theo `printerId`, không biết ngôn ngữ, không tự khoá.
* Mọi loại kết nối đi qua `NativeAdapter`.
* Khoá in theo máy vật lý (`lockKeyOf`), do tầng in giữ.

### Printing

```text
PrintService → PrintRoutingService → PrintScheduler (khoá) → PrinterPrintService
    → IPrintLanguage.encode + PrinterConnectionService.send → NativeAdapter
```

### Paper

* `PaperOptions` = `ContinuousPaper | DieCutPaper`; không đại diện capability phần cứng.
* `PrinterCapabilities` không đại diện print-job configuration.
* Tem rời không cắt; giấy cuộn luôn có `cutterMode`.
* Tràn hàng tem phải được validation.

### Rendering

* Hai render mode: `Command`, `Raster`; `rasterSource` chỉ có tác dụng khi `Raster`.
* Mặc định ESC/POS `Command`, TSPL `Raster`.

### Native

* Native code chỉ nằm ở adapter/native boundary.
* Binary từ TypeScript sử dụng `Uint8Array`; React Native bridge sử dụng Base64.
* Android/vendor behavior chỉ được comment khi không hiển nhiên.

### Code quality

* Main flow phải dễ đọc.
* Nesting nên <= 2 levels.
* Ưu tiên guard clause.
* Function có một responsibility rõ ràng.
* Class có một responsibility chính.
* Không abstraction chỉ để "clean".
* Không wrapper không có ý nghĩa.
* Không comment WHAT.
* Comment WHY, business rule, constraint, workaround.
* Comment phải được update hoặc xóa khi behavior thay đổi.

---

# 61. Pull Request Review Checklist

## Readability

* [ ] Main flow đọc từ trên xuống có dễ hiểu không?
* [ ] Có nesting sâu không?
* [ ] Có thể dùng guard clause không?
* [ ] Có code clever không cần thiết không?
* [ ] Có function wrapper vô nghĩa không?

## Responsibility

* [ ] Function có một purpose rõ ràng không?
* [ ] Class có một responsibility chính không?
* [ ] Có logic bị đặt sai layer không?
* [ ] Có abstraction không thực sự cần thiết không?

## Naming

* [ ] Tên thể hiện intent chưa?
* [ ] Có `data`, `result`, `value`, `item`, `temp` không cần thiết không?
* [ ] Có cần comment chỉ vì tên chưa rõ không?

## Fields

* [ ] Mỗi field có mục đích rõ ràng không?
* [ ] Business meaning có được thể hiện bằng tên không?
* [ ] Constraint quan trọng đã được thể hiện chưa?
* [ ] Invariant phức tạp có nằm ở validation/domain logic thay vì comment không?

## Comments

* [ ] Comment có giải thích WHY không?
* [ ] Có comment WHAT không?
* [ ] Có comment cho business rule quan trọng không?
* [ ] Có comment cho platform limitation/workaround không?
* [ ] Comment có còn đúng với behavior hiện tại không?
* [ ] Có thể refactor code để bỏ comment không?

## Side Effects

* [ ] API/storage/native write có dễ nhận biết không?
* [ ] Function tên `calculate/get/parse` có side effect bất ngờ không?
* [ ] Runtime side effect có nằm đúng responsibility không?

## Architecture

* [ ] Ngôn ngữ in có chỉ encode, không chạm kết nối không?
* [ ] Connection service có chỉ quản lý phiên, không biết ngôn ngữ không?
* [ ] Scheduler có chịu trách nhiệm concurrency không?
* [ ] Khoá in có theo máy vật lý (`lockKeyOf`) không?
* [ ] `deviceId` có chỉ dùng cho định danh máy vật lý và khoá không?
* [ ] Native/vendor SDK có bị leak lên business layer không?

---

# 62. Core Principle

> **Code dễ đọc trước, code ngắn sau.**

> **Tên rõ ràng trước, comment sau.**

> **Comment để giải thích mục đích, rule, constraint và WHY.**

> **Nesting càng ít càng tốt.**

> **Mỗi function/class chỉ nên có một trách nhiệm rõ ràng.**

> **Abstraction phải làm code dễ hiểu hơn, không phải khó hiểu hơn.**

> **Architecture được tổ chức theo responsibility, không theo số lượng pattern.**

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
PrintService                  chọn máy theo kind, khoá theo máy vật lý
    ↓
PrinterService                encode theo ngôn ngữ + gửi qua kết nối
    ↓                ↓
IPrintLanguage   PrinterConnectionService
                     ↓
                 IPrinterAdapter (NativeAdapter)
                     ↓
                 DeviceModule (native Android)
```

Luồng thêm máy in:

```text
DeviceDiscoveryService        tìm thiết bị → DeviceInfo
    ↓
PrinterDetectionService      tra PRINTER_DETECTION_TABLE theo thiết bị quét được
    ↓
createPrinterDraft            mặc định theo ngôn ngữ
    ↓
PrinterRepository             lưu
```

| Component                  | Responsibility                                            |
| -------------------------- | --------------------------------------------------------- |
| `PrintService`             | Public API in; chọn máy theo `kind`, chụp ảnh, đưa lệnh vào hàng đợi |
| `PrintQueue`               | Hàng đợi theo máy vật lý: in lần lượt, thử lại lỗi kết nối, báo kết quả |
| `PrinterService`           | In / in thử một printer: encode rồi gửi                   |
| `IPrintLanguage`           | Encode nội dung thành byte theo một ngôn ngữ lệnh          |
| `PrinterConnectionService` | Phiên kết nối theo `printerId`: mở, đóng, gửi, đọc, trạng thái |
| `PrinterConnectionLock`    | Khoá loại trừ theo máy vật lý                              |
| `IPrinterAdapter`          | Một kết nối qua một cơ chế (native module, SDK hãng)       |
| `DeviceDiscoveryService`   | Tìm thiết bị cho người dùng chọn                          |
| `PrinterDetectionService` | Tra bảng model: ngôn ngữ, khả năng của máy in mới         |
| `PrinterManagementService` | Lưu, xoá (ngắt kết nối trước), bật/tắt máy in đã lưu      |
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
│   ├── device/          DeviceInfo (thiết bị tìm thấy), ConnectedDevice (kết quả connect), DeviceAddress
│   ├── discovery/       DiscoveryStatus, DiscoveryEvent — tiến trình tìm thiết bị
│   ├── connections/     ConnectionType, ConnectionStatus (trạng thái trong phiên, không lưu)
│   ├── printer/         Printer, PrintKind, PrinterLanguage, PrinterCapabilities — lưu xuống bộ nhớ
│   ├── paper/           PaperOptions, PaperSize, PaperType, CutterMode,
│   │                    paperSpec (thông số theo khổ giấy)
│   ├── printing/        PrintOptions, PrintTask (dữ liệu vào), PrintEnqueueResult (kết quả đưa vào hàng đợi),
│   │                    PrintTaskResult (kết quả in một lệnh), PrintFailureKind (phân loại lỗi in)
│   └── templates/       ReceiptTemplateOptions, LabelTemplateOptions, PrintPadding, FontSizePreset (tuỳ chọn mẫu);
│                        ReceiptContent, LabelContent (+ labelPagesOf), PrintItem (nội dung cần in)
│
├── languages/
│   ├── index.ts         barrel: getPrintLanguage, EscPosLanguage, TsplLanguage, IPrintLanguage
│   ├── IPrintLanguage.ts
│   ├── escpos/          EscPosLanguage (encode ảnh bằng GS v 0)
│   └── tspl/            TsplLanguage (encode ảnh bằng BITMAP)
│
├── adapters/
│   ├── IPrinterAdapter.ts
│   ├── native/          NativeAdapter (+ toDeviceError), DeviceModule
│   └── vendor/          VendorAdapter (khung)
│
├── connection/
│   ├── PrinterAdapterFactory.ts / .web.ts   createPrinterAdapter theo nền tảng
│   ├── PrinterConnectionService.ts
│   └── PrinterConnectionLock.ts
│
├── discovery/           DeviceDiscoveryService, NetworkDiscoveryService
├── detection/           PrinterDetectionService, PrinterDetection, PrinterDetectionTable
├── printing/            PrintService, PrintQueue, PrinterService
├── management/          PrinterManagementService, createPrinterDraft
├── permissions/         PrinterPermissionService
├── storage/             PrinterRepository, PrinterStorage
├── rendering/           MonochromeBitmap (PNG → ảnh 1-bit)
├── templates/           index.ts (barrel); ReceiptTemplate, LabelTemplate, PrintLayout (PrintText/PrintRow/
│                        PrintDivider), PrintCodes (QR, mã vạch CODE128), TemplateDefaults (mẫu mặc định)
├── logging/             PrinterLogger
├── errors/              index.ts (barrel), DeviceErrorCode, PrinterErrorCode, PrintErrorCode, ErrorCode (hợp 3 bộ mã)
├── exceptions/          index.ts (barrel + errorCodeOf, toPrinterFeatureException), PrinterFeatureException
│                        (lớp nền), DeviceErrorException, PrinterErrorException, PrintErrorException
│
├── components/          UI quản lý máy in; SamplePrint (bản in thử, dùng mẫu mặc định); PrintFailureSnackbar
│                        (báo lệnh in lỗi, mount ở gốc app)
├── hooks/               usePrintImageCapture (chụp React element thành ảnh in), luồng thêm máy in
├── forms/               schema (máy in, form giấy, LAN, tên), printerRules (canPrintKind)
├── store/
├── utils/               printKindLabels (nhãn UI), paperUtils, printOptionsUtils
│
└── testing/             printerFixtures, printerServiceTestKit, encodeCases
```

## Structure Rules

* `models/` chỉ chứa dữ liệu và hàm thuần suy ra từ dữ liệu; không chứa nhãn UI, không import từ
  `languages/`, `connection/`, `printing/`, `components/`.
* `languages/` chỉ encode; không biết kết nối.
* `adapters/` chứa integration với native module / SDK hãng; không chứa business rule.
* `connection/` quản lý phiên kết nối và khoá; không biết ngôn ngữ in.
* `discovery/` tìm thiết bị; `detection/` tra bảng model máy in.
* `printing/` ghép ngôn ngữ với kết nối để in.
* `storage/` chứa persistence boundary.
* `permissions/` chứa platform permission.
* `templates/` chứa mẫu hoá đơn/tem (component chụp thành ảnh) và giá trị mặc định; không biết máy in hay kết nối.
* `management/` chứa thao tác quản lý máy in đã lưu (`PrinterManagementService`) và giá trị mặc định khi tạo máy mới.
* `logging/` chứa structured logging; `errors/` chứa lỗi dạng dữ liệu và mã lỗi; `exceptions/` chứa exception ném ra.

Không tạo thêm folder chỉ vì muốn "đủ layer".

---

# 4. Core Domain Model

Các trục độc lập, không map cứng `Receipt → ESC/POS`, `Label → TSPL`:

```text
PrintKind        Receipt | Label            loại nội dung một Printer record in
PrintLanguage    EscPos | Tspl              ngôn ngữ lệnh của máy
ConnectionType   Usb | Bluetooth | Lan      đường kết nối
```

Quy ước chung: const-object + type cùng tên (không dùng `enum`); mỗi model một file; summary tiếng Việt cho model và
field cần giải thích.

Ràng buộc duy nhất giữa ngôn ngữ và loại nội dung là `canPrintKind(language, kind)`
(`forms/addPrinter/printerRules.ts`): ESC/POS chỉ in `Receipt`; TSPL in cả hai.
Schema, bước tra bảng model khi thêm máy và UI chọn ngôn ngữ tay cùng dùng hàm này.

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
  connection: DeviceAddress;
  language: PrinterLanguage;
  paper: PaperOptions;
  capabilities: PrinterCapabilities;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Field rules

* `id` sinh khi tạo, không đổi khi sửa. Phiên kết nối và trạng thái được giữ theo `id`.
* `deviceId` — định danh máy vật lý do native trả lúc kết nối (§6); bản nháp chưa kết nối thì rỗng.
* `kind` cố định cho record này. Một máy in vật lý phục vụ cả Hoá đơn lẫn Tem được biểu diễn bằng **2 `Printer`
  record** cùng `deviceId`, khác `kind`. Unique theo cặp (`deviceId`, `kind`).
* `language` (§8), `paper` (§11), `capabilities` (§9).
* Không có `isDefault`.

---

# 6. `deviceId` và khoá in

Native `connect` trả `ConnectedDevice { connectionId, deviceId, address, name?, manufacturer?, model? }`. JS không tự
tính định danh máy từ địa chỉ: chỉ native, sau khi mở được máy, mới biết serial thật và hai địa chỉ có cùng một máy.

| Kết nối   | `deviceId` (native, ổn định qua các lần cắm)    |
| --------- | --------------------------------------------- |
| LAN       | `lan:<host>:<port>`                           |
| Bluetooth | `bluetooth:<MAC viết hoa>`                    |
| USB       | `usb:<vendorId>:<productId>[:<serialNumber>]` |

USB không có serial thì không phân biệt được hai máy cùng model.

* `deviceId` lưu vào `Printer.deviceId`; dùng chống thêm trùng (cặp `deviceId` + `kind`, kiểm sau khi kết nối) và làm
  khoá in: cùng máy vật lý thì in lần lượt, máy khác nhau in song song.
* `address` (USB có serial) lưu vào `Printer.connection`.
* `connectionId` chỉ sống trong phiên kết nối (đổi khi rút ra cắm lại), dùng để gom kết nối: hai lần `connect` ra cùng
  `connectionId` là cùng một kết nối native, dùng chung, không ngắt nhầm của nhau.

**Không bao giờ** so `Printer.deviceId` với `DeviceInfo.deviceId` (§10): mã lúc quét chỉ là key danh sách.

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
}
```

Giá trị mặc định khi tạo máy mới nằm ở `management/PrinterDefaults.ts` (`createPrinterLanguage`,
`createPrinterDraft`).

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

`models/device/` chứa `DeviceInfo` (thiết bị tìm thấy, không lưu) và `DeviceAddress` (địa chỉ để `connect`, cũng là
kiểu của `Printer.connection`); `models/discovery/` là tiến trình tìm thiết bị.

```ts
/** Một thiết bị tìm thấy khi quét, khớp `DeviceInfo` native trả về. */
interface DeviceInfo {
  deviceId: string;        // mã quét của native trong lần discovery hiện tại; key danh sách
  name: string;            // native không có thì dùng MAC hoặc đường dẫn thiết bị
  manufacturer?: string;   // chỉ USB
  model?: string;          // chỉ USB
  hasPermission: boolean;  // quét không mở hộp thoại xin quyền
  address: DeviceAddress;  // để connect; chọn máy thì gán vào Printer.connection
}

type DeviceAddress = UsbDeviceAddress | BluetoothDeviceAddress | LanDeviceAddress;

/** Trạng thái một lần tìm thiết bị. */
const DiscoveryStatus = { Loading, Found, Empty, Error };

type DiscoveryEvent =                       // field `status` phân loại
  | { status: Loading } | { status: Found; devices: DeviceInfo[] }
  | { status: Empty } | { status: Error; error: PrinterFeatureException };
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
Form giấy là react-hook-form + zod (`forms/addPrinter/PaperFormSchema.ts`), giống form LAN: ô kích thước tem giữ
dạng chữ nên được trống khi đang gõ; schema kiểm từng ô, hợp lệ thì `transform` ra `PaperOptions`.

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

`dieCutRowOverflow` nằm ở `utils/paperUtils.ts`, nhận `PaperOptions` hợp lệ; schema lưu (`PrinterSchema`) và form
giấy (`PaperFormSchema`) cùng gọi trong `superRefine`.

---

# 13. Paper Module

```text
models/paper/
├── PaperOptions.ts     ContinuousPaper | DieCutPaper
├── PaperSize.ts        58 | 80 | 100 | 104 (mm)
├── PaperType.ts        Continuous | DieCut
├── CutterMode.ts       None | PerJob | PerRow
└── paperSpec.ts        thông số theo khổ: vùng in, bề rộng ảnh

utils/
└── paperUtils.ts       resolveEffectiveCutterMode (DieCut → None, Continuous → paper.cutterMode),
                        dieCutRowOverflow (hàng tem tràn khổ)

forms/addPrinter/
└── PaperFormSchema.ts  PaperFormValues (ô tem dạng chữ), paperFormSchema, toPaperFormValues,
                        toPaperOptions, paperFormErrorOf
```

`models/paper/` chỉ chứa kiểu và dữ liệu của giấy (`paperSpec`); hàm tính trên giấy nằm ở `utils/paperUtils.ts`.
Kiểm tra ô nhập (trống, không phải số) thuộc form; quy tắc trên giấy hợp lệ (tràn khổ) dùng chung cho form và
schema lưu.

---

# 14. Rendering

Mọi lệnh in là ảnh. Nội dung in là React element dựng từ mẫu trong `templates/` (`ReceiptTemplate`,
`LabelTemplate`): cart chuyển đơn hàng thành `ReceiptContent`/`LabelContent`, "In thử" dùng dữ liệu mẫu.
`usePrintImageCapture` render element đó ngoài màn hình theo bề rộng giấy rồi chụp thành PNG base64. Ngôn ngữ decode
ảnh thành monochrome 1-bit rồi gửi lệnh ảnh của mình (`GS v 0` cho ESC/POS, `BITMAP` cho TSPL), nên in đúng tiếng
Việt trên mọi máy bất kể codepage hay font của máy.

Quy ước của mẫu:

* Cỡ chữ, padding, khoảng cách tính bằng dot (8 dot = 1mm). Khung chụp không có padding: lề do mẫu tự đặt.
* Cỡ chữ đặt nhanh theo `FontSizePreset` (Small × 0,85 / Normal / Large × 1,2 so với mức Normal); hoá đơn mặc định
  dùng Small, tem dùng Normal.
* Mỗi con tem là một lệnh in riêng (lệnh in tem chỉ nhận ảnh cao tối đa một con tem). `labelPagesOf` tách mỗi phần
  món thành một ly; ly nhiều loại topping hơn `maxToppingsPerLabel` thì tách tem, cỡ tem không tự tăng.
* Logo, SĐT, bàn, thu ngân, VAT, Wi-Fi, QR chuyển khoản, mã vạch đơn, tên khách trên tem mặc định tắt; bật mà nội
  dung thiếu dữ liệu thì bỏ qua dòng đó. QR vẽ bằng `qrcode-generator`, mã vạch lấy bộ mã hoá CODE128 của
  `jsbarcode` (không dùng phần vẽ canvas/svg); cả hai vẽ thành View đen trắng.
* Tuỳ chọn mẫu hiện là hằng số mặc định, chưa lưu và chưa có màn hình chỉnh.

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
/** Một ngôn ngữ lệnh máy in: chỉ biến ảnh thành byte, không biết kết nối. */
interface IPrintLanguage {
  encode(printer: Printer, image: string, options?: PrintOptions): Uint8Array;   // image: PNG base64
}

getPrintLanguage(type: PrintLanguage): IPrintLanguage
```

* `encode` kiểm tra rồi encode; ảnh hỏng (`INVALID_IMAGE`) hay cao quá giấy (`IMAGE_TOO_LARGE`) ném
  `PrintErrorException`.
* `PrintOptions` (`utils/printOptionsUtils.ts` chuẩn hoá): `copies` (mặc định 1), `cut` (`false` thì không cắt;
  giấy tem không bao giờ cắt), `feedMm` (đẩy thêm giấy), `cashDrawer` (mở ngăn kéo).
* `EscPosLanguage`: lệnh `GS v 0`; nhiều bản thì lặp lại ảnh, mỗi bản `ESC J` (đẩy giấy) rồi `ESC m` (cắt);
  `cashDrawer` gửi `ESC p 0 25 250` sau cùng.
* `TsplLanguage`: lệnh `SIZE`/`GAP`, `BITMAP` mỗi cột tem, `SET CUTTER`, `PRINT copies,1`, rồi `FEED` nếu có
  `feedMm`; bỏ qua `cashDrawer` (máy tem không có ngăn kéo). Chiều cao `SIZE` theo cấu hình giấy của máy in, không
  theo loại nội dung: giấy tem theo `itemHeightMm` (ảnh cao hơn con tem → `IMAGE_TOO_LARGE`); giấy cuộn đúng bằng
  nội dung (làm tròn lên mm), không giới hạn, để máy chỉ đẩy phần đã in.
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
  listDevices(connectionType): Promise<DeviceInfo[]>;
  connect(connection: DeviceAddress): Promise<void>;   // mở được rồi mới trả kết nối cũ
  write(bytes: Uint8Array): Promise<void>;
  read(): Promise<Uint8Array | null>;                     // null khi quá hạn của native module
  onLost(callback): Unsubscribe;                           // kết nối của chính instance này mất
  disconnect(): Promise<void>;
}
```

* Mỗi instance giữ tối đa một kết nối.
* `NativeAdapter` dùng cho USB, Bluetooth và LAN qua native module `DeviceModule`: chỉ chuyển lời gọi xuống native
  và đổi lỗi, giữ `connectionId` của kết nối đang mở. Hạn ghi (theo cỡ dữ liệu) và hạn đọc (cố định) nằm trong
  `DeviceModule.ts`, không lộ ra adapter. `onLost` nghe `DeviceDisconnected` và so `connectionId` đó.
  Dùng chung kết nối giữa nhiều `Printer` là việc của `PrinterConnectionService`.
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

`PrinterConnectionService` giữ kết nối theo `connectionId` native và trạng thái theo `printerId` — dùng cho cả máy đã
lưu lẫn bản nháp đang thêm. Mỗi lần `connect` đều hỏi native; native trả lại kết nối đang mở nếu cùng máy, khi đó dùng
lại kết nối JS cũ và bỏ adapter mới (không ngắt). Nhiều `Printer` trỏ cùng một máy (vd hoá đơn và tem) dùng chung một
adapter; `Printer` cuối cùng ngắt thì mới đóng. Ngắt khoá theo `deviceId` của kết nối.

| Hàm | Làm gì |
| --- | --- |
| `connect(printer)` | Hỏi native qua adapter mới, `Connecting` → `Connected` / `Error`; trả `ConnectedDevice` |
| `ensureConnected(printer)` | Trước khi in: đã kết nối thì thôi, đang kết nối thì chờ lượt đó, chưa thì kết nối |
| `disconnect(printerId)` | `Disconnecting` → trả adapter → `Disconnected`; huỷ cả lượt `connect` đang chạy |
| `send(printerId, bytes)` | Ghi qua adapter; chưa kết nối → `NOT_CONNECTED`; lỗi do kết nối hỏng thì bỏ phiên |
| `read(printerId)` | Đọc phản hồi; `null` khi quá hạn |
| `getStatus` / `onStatusChange` | Trong bộ nhớ; chưa từng kết nối là `Idle`; UI đọc qua `useConnectionStatus` |
| `forget(printerId)` | Dọn trạng thái máy đã xoá / bản nháp đã đóng (sau khi ngắt) |
| `reconnect(printerId)`, `connectEnabledPrinters()` | Đọc máy in đã lưu; mở app kết nối máy đang bật |

* `connect`: Bluetooth thì xin quyền trước. Thành công mới thay phiên cũ rồi trả adapter cũ (lỗi khi trả chỉ ghi
  log); thất bại thì phiên cũ giữ nguyên.
* Mỗi `connect` là một lượt; chỉ lượt mới nhất được đổi trạng thái. Lượt bị thay (có `connect` mới hơn hoặc
  `disconnect`) mà mở được kết nối thì trả kết nối đó ngay và kết thúc êm, thất bại thì vẫn ném lỗi nhưng không đổi
  trạng thái.
* Adapter báo `onLost` → bỏ phiên, trả adapter, `Disconnected`; `send`/`read` sau đó báo `NOT_CONNECTED` (adapter
  đã bị thay thì bỏ qua).
* Listener trạng thái ném lỗi chỉ bị ghi log, không làm hỏng việc kết nối hay chặn listener khác.
* Mở/gắn và gỡ/đóng cùng một máy vật lý chạy lần lượt (hàng đợi riêng của service, khác khoá in), để một lần mở
  gửi trước lệnh đóng không nhận phải kết nối sắp đóng.
* Máy in chuyển sang máy vật lý khác thì gỡ khỏi máy cũ trong khoá in của máy cũ.
* `reconnect` không mở lại kết nối nếu còn `Printer` khác đang dùng chung máy vật lý.
* Không giới hạn số máy cùng loại kết nối kết nối cùng lúc.
* Không biết ngôn ngữ in; log kết nối không mang ngôn ngữ.
* **Không tự khoá**: `PrinterService.print` kết nối bên trong khoá của `PrintService`, khoá lại sẽ treo.

Không chịu trách nhiệm `print`, `route`, `render`, `encode`, `save`.

---

# 21. PrinterConnectionLock

```ts
class PrinterConnectionLock → runExclusive(key, task)   // khoá in: key = deviceId native
printerConnectionLock    instance dùng chung
```

Một lệnh in gồm nhiều lần gọi native; native chỉ giữ thứ tự từng lần gọi chứ không giữ trọn cả lệnh in, nên hai lệnh
in cùng một máy phải chạy lần lượt. Lệnh in (`PrintQueue`), nút "In thử" (`PrinterService.testPrint`) và lệnh ngắt
kết nối dùng chung một khoá. Khoá không reentrant.

Không log key: key là `deviceId`, nhúng IP/MAC.

---

# 22. Printing Services

## `PrintService`

Public entry point. `print(kind, render, title)` chọn máy nhận từ repository theo `printer.kind` và `enabled` (không có
máy thì `NoAvailablePrinter`, không chụp), gọi `render(paper)` một lần cho mỗi cấu hình giấy khác nhau (lần lượt, vì
chỉ có một khung chụp; chụp hỏng thì `CaptureFailed`, không lệnh nào vào hàng đợi), tạo một `PrintTask` cho mỗi máy
với ảnh đúng giấy của nó, đưa vào `PrintQueue` rồi trả `Queued` ngay, không chờ in. `title` (vd `Hoá đơn #A1024`)
dùng để báo lỗi. Không chứa device discovery, connection lifecycle, encoding.

## `PrintQueue`

```ts
class PrintQueue → enqueue(task), onTaskFinished(listener) → unsubscribe
printQueue        instance dùng chung
PRINT_RETRY_DELAYS_MS = [2000, 5000]
```

Mỗi `deviceId` một hàng, in lần lượt đúng thứ tự enqueue; máy khác nhau in song song. Mỗi lần gửi chạy trong
`PrinterConnectionLock` của máy; thời gian chờ thử lại nằm ngoài khoá. Lệnh in xong (thành công hoặc lỗi hẳn) bị xoá
khỏi hàng ngay, kết quả báo qua `onTaskFinished`; không giữ lệnh lỗi, không lưu xuống máy (tắt app là mất lệnh đang
chờ). Kết nối lại máy không tự in lại gì.

## `PrinterService`

```text
print(printerId, image, options?)
  lấy Printer → chưa Connected thì connect → getPrintLanguage(type).encode → send
testPrint(printer, image, options?)
  như trên, máy có thể chưa lưu; tự khoá theo máy vật lý, không qua hàng đợi
```

`print` không tự khoá (luôn được `PrintQueue` gọi bên trong khoá). Ghi log `print*` / `testPrint*` kèm ngôn ngữ.

---

# 23. Complete Print Flow

```text
PrintService → target printers (mỗi target một task) → PrintQueue.enqueue → trả Queued
    ↓ (worker của task.deviceId)
PrinterConnectionLock(task.deviceId)
    ↓
PrinterService
    ├── PrinterConnectionService.connect (nếu chưa Connected)
    ├── IPrintLanguage.encode
    └── PrinterConnectionService.send → NativeAdapter → DeviceModule
    ↓
PrintQueue.onTaskFinished → PrintFailureSnackbar (khi lỗi)
```

Máy khác nhau in song song; hai record cùng máy vật lý chung một hàng.

---

# 24. Print Failure Policy

POS print failure không được làm crash sales flow. `PrintService.print` không throw và không chờ in; lỗi in đến sau
qua `PrintQueue.onTaskFinished`, hiện bằng `PrintFailureSnackbar` ở gốc app (gộp các lỗi đến trong 1 giây theo máy).
In lại bằng "Lịch sử đơn" (in cả bill lẫn tem).

`PrintFailureKind` quyết định cách xử lý một lệnh lỗi:

| Nhóm | Mã lỗi | Xử lý |
|---|---|---|
| `ConnectFailed` | `CONNECTION_FAILED` | Thử lại sau 2s, 5s; vẫn lỗi thì bỏ hết lệnh của máy |
| `DeviceUnavailable` | `CONNECTION_LOST`, `NOT_CONNECTED`, `DEVICE_NOT_FOUND`, `BLUETOOTH_DISABLED`, `SERVICE_CLOSED`, `PERMISSION_DENIED` | Không thử lại, bỏ hết lệnh của máy |
| `TaskFailed` | `WRITE_FAILED`, `WRITE_TIMEOUT` và mọi mã còn lại | Không thử lại, chỉ bỏ lệnh đó |

```text
Native / adapter error (DeviceErrorException), encode error (PrintErrorException)
    ↓
PrinterService (log print* failed)
    ↓
PrintQueue (thử lại / bỏ lệnh / bỏ cả hàng; PrintTaskResult Failed + PrinterFeatureException)
    ↓
PrintFailureSnackbar, logging
```

Không swallow error ở mọi layer. Chỉ public operation quyết định error policy phù hợp với POS flow.

---

# 25. Device Discovery

`DeviceDiscoveryService.discover(connectionType, onEvent): Unsubscribe`

* LAN → `Empty` ngay (người dùng nhập IP; `NetworkDiscoveryService` gợi ý IP WiFi hiện tại).
* Bluetooth → xin quyền rồi `adapter.listDevices` (chỉ máy đã ghép đôi).
* USB → `adapter.listDevices`; quét không mở hộp thoại xin quyền (`hasPermission` cho biết đã có quyền chưa).
* Native báo "No Device Found" bằng lỗi thì coi là rỗng.
* Huỷ thì không báo thêm sự kiện.
* Log `debug` chi tiết thiết bị chỉ trong dev; `PrinterLogger.discovery*` không mang MAC.

---

# 26. Printer Detection

`PrinterDetectionService.detect(device: DeviceInfo): PrinterDetection | undefined`

* Chỉ tra `PRINTER_DETECTION_TABLE` (`detection/PrinterDetectionTable.ts`) theo thiết bị quét được để biết hãng,
  model, ngôn ngữ (`PrinterLanguage`) và khả năng (`PrinterCapabilities`). Không kết nối, không gửi/đọc gì từ máy in,
  không lưu.
* Một định nghĩa khớp khi khai báo ít nhất một trường trong `PrinterIdentifiers` và mọi trường đã khai báo đều khớp:
  `vendorId`/`productId` so với kết nối USB; `manufacturer`/`product` so với tên hãng/sản phẩm thiết bị báo (không phân
  biệt hoa thường, bỏ khoảng trắng thừa; thiết bị không có tên sản phẩm thì so bằng tên thiết bị). Nhiều định nghĩa
  khớp thì lấy cái đầu tiên.
* Không có trong bảng (LAN luôn vậy vì không quét), hoặc ngôn ngữ của model không in được loại nội dung đang thêm
  (`canPrintKind`) → người dùng chọn ngôn ngữ tay. Khả năng khi đó lấy mặc định theo
  ngôn ngữ (`defaultCapabilitiesOf`).
* Kết nối sau khi biết ngôn ngữ do `usePrinterDetection` gọi `PrinterConnectionService.connect`.

---

# 27. Printer Add Flow

```text
Chọn loại kết nối
    ↓
Chọn thiết bị (DiscoveredDeviceList) / nhập IP + port
    ↓
Tra bảng model (usePrinterDetection) → kết nối; không có trong bảng (luôn vậy với LAN) → chọn ngôn ngữ tay rồi kết nối
    ↓
Kết nối xong: native trả deviceId, địa chỉ có serial, tên → cảnh báo trùng (deviceId + kind)
    ↓
Chỉnh giấy (form giấy, lưu cùng lúc bấm Lưu) → In thử
    ↓
Lưu (createPrinterDraft + giá trị người dùng chỉnh); không ngắt hay kết nối lại
```

Identity check phải xảy ra trước khi lưu. Ngôn ngữ chỉ có sau khi kết nối thành công nên máy mới phải kết nối được
mới lưu được. Lúc sửa, phần kết nối khoá cho tới khi bấm "Đổi kết nối" (bỏ ngôn ngữ, phải kết nối lại). Đóng form
mà chưa lưu: chỉ khi form đã tự kết nối mới trả máy về như cũ (máy đang sửa vốn đang kết nối thì kết nối lại bằng
cấu hình đã lưu, còn lại thì ngắt). Hook `useAddPrinterFlow` điều phối `useConnectionSetup`,
`usePrinterDetection`, `useTestPrint`.

---

# 28. Permissions

`permissions/PrinterPermissionService.ts` chỉ xử lý platform permission. Quyền Bluetooth được xin ở
`DeviceDiscoveryService` (trước khi quét) và `PrinterConnectionService` (trước khi kết nối) — hai nơi chạm platform
boundary. Không đưa permission checking vào ngôn ngữ in hay `PrintService`.

---

# 29. Configuration Management

* `management/PrinterManagementService.ts`: `save` (thêm hoặc sửa theo `id`), `remove` (ngắt kết nối rồi xoá),
  `setEnabled`. Hook quản lý gọi service rồi cập nhật store.
* `management/PrinterDefaults.ts`: `createPrinterDraft({ id?, kind, connection, language })` — máy in mới với mọi
  giá trị mặc định (giấy cuộn 80mm cắt cuối job, capabilities theo ngôn ngữ).
  Mọi nơi tạo máy in dùng hàm này.
* `forms/addPrinter/printerRules.ts`: `canPrintKind`.

Không chịu trách nhiệm physical discovery, actual printing, queue.

---

# 30. Storage

```text
storage/
├── PrinterRepository.ts   persistence boundary: tính lại deviceId, chống trùng (deviceId + kind), validate schema
├── PrinterStorage.ts      MMKV implementation + storage version
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
| `detection`  | `printerDetected`, `printerNotDetected` |
| `print` / `test-print` | `printSucceeded`, `printFailed`, `testPrintSucceeded`, `testPrintFailed` |

Không log binary payload, MAC/IP hay nội dung hoá đơn.

---

# 33. Errors

Ba bộ mã lỗi ổn định, mỗi bộ một tầng:

| Bộ mã              | Tầng                                    | Exception               |
| ------------------ | --------------------------------------- | ----------------------- |
| `DeviceErrorCode`  | thiết bị, kết nối, đọc ghi (khớp 1:1 native) | `DeviceErrorException`  |
| `PrinterErrorCode` | cấu hình và tìm máy in                  | `PrinterErrorException` |
| `PrintErrorCode`   | một lệnh in (ảnh, encode, không có máy nhận) | `PrintErrorException`   |

Ba exception kế thừa `PrinterFeatureException` nên nơi gọi bắt chung và đọc `code` (`ErrorCode`, hợp 3 bộ mã);
`errorCodeOf` trả `UNKNOWN_ERROR` cho lỗi không phải exception của feature, `toPrinterFeatureException` bọc lỗi đó
thành `PrintErrorException(UNKNOWN_ERROR)`. Job in, kết quả in và event lỗi tìm thiết bị mang thẳng
exception, không có bản sao dạng dữ liệu. `toDeviceError` (`adapters/native/NativeAdapter.ts`) giữ nguyên mã native và
gắn thông báo tiếng Việt; lỗi native không mang mã thiết bị được ném nguyên.

Error code phục vụ logging, diagnostics, UI mapping, monitoring, testing. Không dùng error message làm machine-readable
identifier.

---

# 34. TypeScript Readability Rules

## 34.1 Main flow phải nhìn thấy được

Ưu tiên:

```ts
const printer = repository.findById(printerId);

if (!printer) {
  throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_FOUND, message });
}

if (connectionService.getStatus(printer.id) !== ConnectionStatus.Connected) {
  await connectionService.connect(printer);
}

const bytes = getPrintLanguage(printer.language.type).encode(printer, image, options);
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
      await send(printer, image);
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

await send(printer, image);
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
interface PaperFormValues {
  type: PaperType;

  /** Chỉ kiểm khi type là DieCut. */
  columns: string;
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
forms/addPrinter/PaperFormSchema.ts
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
await lock.runExclusive(printer.deviceId, () =>
  send(printer, image),
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
PrinterDetectionService  → khớp trường nhận diện, không phân biệt hoa thường, định nghĩa đầu tiên thắng
DeviceDiscoveryService   → quyền, ánh xạ native → DeviceInfo
PrinterService           → encode + gửi, kết nối khi cần, không tự khoá khi print
PaperFormSchema          → ô trống/sai, tràn khổ, đổi qua lại PaperOptions
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

Chỉ lưu serializable configuration: `Printer`, `DeviceAddress`, `PrinterLanguage`, `PrinterCapabilities`,
`PaperOptions`.

---

# 60. Final Architecture Invariants

### Printer

* Không có `isDefault`.
* `deviceId` do native trả lúc kết nối, định danh máy vật lý; repository không tự tính.
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
* Khoá in theo máy vật lý (`deviceId` native), do tầng in giữ; kết nối gom theo `connectionId` native.

### Printing

```text
PrintService (khoá) → PrinterService
    → IPrintLanguage.encode + PrinterConnectionService.send → NativeAdapter
```

### Paper

* `PaperOptions` = `ContinuousPaper | DieCutPaper`; không đại diện capability phần cứng.
* `PrinterCapabilities` không đại diện print-job configuration.
* Tem rời không cắt; giấy cuộn luôn có `cutterMode`.
* Tràn hàng tem phải được validation.

### Rendering

* Mọi lệnh in là ảnh chụp từ React element; không có chế độ in lệnh văn bản.

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
* [ ] Khoá in có theo máy vật lý (`deviceId` native) không?
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

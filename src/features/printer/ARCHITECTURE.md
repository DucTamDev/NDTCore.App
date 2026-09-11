# NDTCore POS — Printer Architecture

## 1. Mục tiêu

Printer feature được thiết kế cho production Android POS với các mục tiêu:

* Readability.
* Single Responsibility.
* Explicit dependency direction.
* Dễ test.
* Dễ mở rộng driver và connection type.
* Cô lập Android/vendor SDK khỏi business logic.
* Hỗ trợ nhiều printer trong cùng POS.
* Hỗ trợ một physical printer phục vụ nhiều loại nội dung (Hoá đơn + Tem) qua nhiều `Printer` record độc lập, cùng `identityKey`.
* Không tạo abstraction nếu abstraction không mang lại boundary hoặc responsibility thực sự.

Nguyên tắc cốt lõi:

> Code dễ đọc trước, code ngắn sau.

> Tên rõ ràng trước, comment sau.

> Comment để giải thích WHY, business rule, constraint và limitation.

> Mỗi function/class chỉ có một responsibility chính.

> Abstraction phải làm code dễ hiểu hơn.

---

# 2. Architecture Overview

Runtime print flow:

```text
PrintService
    ↓
PrintRoutingService
    ↓
PrintScheduler
    ↓
PrinterPrintService
    ↓
PrinterConnectionService
    ↓
PrinterDriver
    ↓
Transport
    ↓
Native Adapter
    ↓
Android / Vendor SDK
```

Mỗi layer có một responsibility rõ ràng.

| Component                  | Responsibility                                    |
| --------------------------- | -------------------------------------------------- |
| `PrintService`             | Public API cho print operation                    |
| `PrintRoutingService`      | Xác định printer nào cần nhận document            |
| `PrintScheduler`           | Queue, ordering và concurrency                    |
| `PrinterPrintService`      | Thực thi print/test-print cho một printer         |
| `PrinterConnectionService` | Connection lifecycle                              |
| `PrinterConnectionLock`    | Serialize operation theo runtime resource         |
| `PrinterDriver`            | Protocol-specific behavior                        |
| `Transport`                | Gửi byte tới connection                           |
| Native Adapter             | Bridge tới Android/vendor API                     |
| `PrinterDiscoveryService`  | Discovery và identification                       |
| `PrinterResolver`          | Mapping device identity vào printer configuration |
| `PrinterConfigService`     | Quản lý printer configuration                     |
| `PrinterRepository`        | Persistence boundary                              |
| `PrinterStorage`           | MMKV implementation                               |
| `PrinterPermissionService` | Platform permission                               |
| `PrinterLogger`            | Structured logging                                |

Không đưa responsibility của một layer sang layer khác chỉ để giảm số lượng file.

---

# 3. Feature Structure

```text
src/features/printer/
├── ARCHITECTURE.md
│
├── models/
│   ├── printer/
│   ├── printing/
│   └── paper/
│
├── drivers/
│   ├── escpos/
│   └── tspl/
│       └── strategies/
│
├── transports/
│
├── discovery/
│   ├── DeviceScanService.ts
│   ├── NetworkInfoService.ts
│   ├── PrinterDiscoveryService.ts
│   └── PrinterResolver.ts
│
├── printing/
│   ├── PrintRoutingService.ts
│   ├── PrintScheduler.ts
│   ├── PrintService.ts
│   └── PrinterPrintService.ts
│
├── connection/
│   ├── PrinterConnectionService.ts
│   └── PrinterConnectionLock.ts
│
├── permissions/
│   └── PrinterPermissionService.ts
│
├── management/
│   └── PrinterConfigService.ts
│
├── storage/
│   ├── PrinterRepository.ts
│   ├── PrinterStorage.ts
│   └── PrinterWriteInput.ts
│
├── paper/
│   ├── cutter.ts
│   ├── paperSpec.ts
│   └── validation.ts
│
├── adapters/
│   ├── IPrinterAdapter.ts
│   ├── resolvePrinterAdapter.ts
│   ├── library/
│   ├── native/
│   │   ├── NativeAdapter.ts
│   │   ├── PrinterNativeModule.ts
│   │   ├── utils/
│   │   │   └── buffer-helper.ts
│   │   └── EPToolkit.ts
│   └── vendor/
│
├── logging/
│   └── PrinterLogger.ts
│
├── errors/
│   └── PrinterError.ts
│
├── components/
├── hooks/
├── forms/
├── store/
├── utils/
│
└── testing/
    ├── printerFixtures.ts
    └── printerServiceTestKit.ts
```

## Structure Rules

* `models/` chỉ chứa domain/data contracts.
* `drivers/` chứa protocol behavior.
* `transports/` chứa connection transport.
* `adapters/` chứa integration với library/native/vendor.
* `discovery/` chứa discovery và identity resolution.
* `printing/` chứa print orchestration.
* `connection/` chỉ xử lý connection lifecycle và resource locking.
* `paper/` chứa paper calculation, specification và validation.
* `storage/` chứa persistence boundary.
* `permissions/` chứa platform permission.
* `management/` chứa configuration management.
* `logging/` chứa structured logging.
* `errors/` chứa printer-specific errors.

Không tạo thêm folder chỉ vì muốn "đủ layer".

---

# 4. Core Domain Model

## 4.1 Independent Axes

Printer architecture không map cứng:

```text
Receipt → ESC/POS
Label   → TSPL
```

Thay vào đó, các concept độc lập:

```text
PrintType
PrinterDriverType
PrinterConnectionType
RenderMode
```

Ví dụ:

```ts
export const PrintType = {
  Receipt: 'Receipt',
  Label: 'Label',
} as const;

export const PrinterDriverType = {
  EscPos: 'EscPos',
  Tspl: 'Tspl',
} as const;

export const PrinterConnectionType = {
  Usb: 'Usb',
  Bluetooth: 'Bluetooth',
  Lan: 'Lan',
} as const;
```

Driver TYPE quyết định content type nào driver đó CÓ THỂ hỗ trợ (`DRIVER_CAPABILITIES` — xem §9). Nhưng mỗi `Printer` record chỉ gắn với ĐÚNG 1 `type` cụ thể — xem §5.

---

# 5. Printer Model

Một `Printer` là cấu hình atomic: ĐÚNG 1 `connection` + ĐÚNG 1 `driver` + ĐÚNG 1 `paper` config + ĐÚNG 1 `type` (loại nội dung cố định).

```ts
export interface Printer {
  id: string;
  identityKey: string;
  type: PrintType;
  name: string;
  vendor?: string;
  model?: string;
  connection: PrinterConnection;
  driver: PrinterDriver;
  paper: PrintPaperConfig;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Field rules

`id`

* Stable identifier của printer configuration.
* Dùng để reference printer trong storage, routing và runtime operation.

`identityKey`

* Dùng để nhận diện physical printer — chỉ phụ thuộc `connection`, không phụ thuộc `driver`.
* Dùng cho duplicate prevention.
* Không dùng để lock runtime resource (xem `resourceKey`, §6).
* Ràng buộc unique là cặp `(identityKey, type)`, không phải `identityKey` một mình — một physical printer có thể có nhiều `Printer` record (mỗi record một `type`) cùng `identityKey`.

`type`

* Loại nội dung CỐ ĐỊNH của printer record này: `PrintType.Receipt` hoặc `PrintType.Label`.
* Không đổi được sau khi tạo — đổi loại nội dung nghĩa là tạo printer record khác.

`name`

* Display name do application quản lý.

`vendor`, `model`

* Thông tin tham khảo, lấy từ `identify()` lúc thêm printer — không dùng cho business logic.

`connection`

* Thông tin connection của printer.
* Là discriminated union theo `PrinterConnectionType`.

`driver`

* ĐÚNG 1 driver được cấu hình cho printer — không phải mảng.
* `driver.type` phải nằm trong `DRIVER_CAPABILITIES[driver.type].contentTypes` mới hỗ trợ được `printer.type` (enforce ở `PrinterSchema.ts`, xem §9).

`paper`

* Cấu hình giấy (`PrintPaperConfig`) áp dụng cho printer này.

`capabilities`

* Physical capabilities được phát hiện hoặc cấu hình.
* Không dùng để thay thế driver configuration.

`autoReconnect`

* Có tự động reconnect khi mất kết nối hay không.

`enabled`

* Xác định printer có được routing vào print job hay không.

Không có:

```ts
isDefault
```

Printer selection được quyết định bởi routing configuration.

### Một physical printer phục vụ nhiều loại nội dung

Một máy in vật lý phục vụ cả Hoá đơn lẫn Tem (ví dụ máy TSPL) được biểu diễn bằng **2 `Printer` record riêng biệt**, cùng `identityKey` (cùng physical device), khác `type` — có thể cùng `connection`, khác `driver` config (ví dụ cùng Bluetooth device nhưng mỗi record một `PrinterDriverConfig`). Xem `discovery/PrinterResolver.ts` và `storage/PrinterRepository.ts`.

---

# 6. Identity Key và Resource Key

Hai concept này không được merge.

## `identityKey`

Dùng để trả lời:

> "Đây có phải cùng một physical printer không?"

Ví dụ:

```text
usb:<vendorId>:<productId>:<serialNumber>
bluetooth:<deviceId>
lan:<ip>:<port>
```

Identity key phục vụ:

* Duplicate prevention.
* Device matching.
* Configuration resolution.

## `resourceKey`

Dùng để trả lời:

> "Những operation nào không được chạy đồng thời?"

Resource key phục vụ:

* Concurrency control.
* Connection locking.
* Scheduler serialization.

Ví dụ:

```text
usb

escpos:bluetooth
escpos:lan

tspl:bluetooth:<deviceId>
tspl:lan:<ip>:<port>
```

### Resource rules

#### USB

```text
usb
```

USB native layer sử dụng shared runtime resource.

Do đó:

```text
ESC/POS USB
TSPL USB
```

không được execute concurrently.

#### ESC/POS Bluetooth

```text
escpos:bluetooth
```

ESC/POS library có singleton scope theo Bluetooth namespace.

#### ESC/POS LAN

```text
escpos:lan
```

ESC/POS library có singleton scope theo LAN namespace.

#### TSPL Bluetooth

```text
tspl:bluetooth:<deviceId>
```

TSPL transport được quản lý theo connection cụ thể.

#### TSPL LAN

```text
tspl:lan:<ip>:<port>
```

Mỗi network endpoint là một resource độc lập.

---

# 7. Printer Connection

```ts
export type PrinterConnection =
  | UsbPrinterConnection
  | BluetoothPrinterConnection
  | LanPrinterConnection;

export interface UsbPrinterConnection {
  type: typeof PrinterConnectionType.Usb;
  vendorId: number;
  productId: number;
  serialNumber?: string;
}

export interface BluetoothPrinterConnection {
  type: typeof PrinterConnectionType.Bluetooth;
  deviceId: string;
  name?: string;
}

export interface LanPrinterConnection {
  type: typeof PrinterConnectionType.Lan;
  host: string;
  port: number;
}
```

Discriminated union được sử dụng để đảm bảo connection-specific fields được kiểm tra bởi TypeScript.

Không dùng:

```ts
type PrinterConnection = {
  type: string;
  deviceId?: string;
  host?: string;
  port?: number;
};
```

vì kiểu này cho phép invalid state.

---

# 8. Printer Driver

Driver chịu trách nhiệm protocol-specific behavior.

```text
PrinterDriver
    ↓
Transport
```

Driver biết:

* protocol;
* supported content types;
* encoding;
* rendering strategy;
* command generation;
* protocol-specific limitation.

Driver không chịu trách nhiệm:

* persistence;
* printer routing;
* scheduling;
* permission management;
* UI;
* global configuration.

---

# 9. Driver Capability

`PrinterDriver` là field của `Printer` (§5) — mỗi `Printer` có ĐÚNG 1 driver, không phải mảng:

```ts
export interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  config: PrinterDriverConfig;
}

export interface PrinterDriverConfig {
  renderMode: RenderMode;
}
```

`DriverCapabilities` là bảng TĨNH theo driver TYPE, trả lời "driver loại này CÓ THỂ phục vụ content type nào" — dùng để lọc candidate lúc discovery và validate ở `PrinterSchema.ts` (driver type phải hỗ trợ `printer.type`), KHÔNG phải config của một `Printer` cụ thể:

```ts
export interface DriverCapabilities {
  contentTypes: PrintType[];
  defaultConfig: PrinterDriverConfig;
}

export const DRIVER_CAPABILITIES: Record<PrinterDriverType, DriverCapabilities> = {
  [PrinterDriverType.EscPos]: {
    contentTypes: [PrintType.Receipt],
    defaultConfig: { renderMode: RenderMode.Encoder },
  },

  [PrinterDriverType.Tspl]: {
    contentTypes: [PrintType.Receipt, PrintType.Label],
    defaultConfig: { renderMode: RenderMode.Bitmap },
  },
};
```

`PrintType` và `PrinterDriverType` vẫn là hai independent concepts — không map cứng 1-1.

Không tạo type:

```ts
type PrinterKind = 'receipt-printer' | 'label-printer';
```

Một physical printer hỗ trợ nhiều content type (ví dụ TSPL) được biểu diễn bằng nhiều `Printer` record độc lập, mỗi record một `type` — không phải một `Printer` với nhiều driver/content type (xem §5).

---

# 10. Print Paper Configuration

Tên chính thức:

```ts
PrintPaperConfig
```

Không sử dụng:

```text
PrintMedia
PrinterPaperConfig
media/
models/media/
```

`PrintPaperConfig` mô tả **paper configuration của print job**.

Nó không mô tả physical capability của printer.

```ts
export const PrintPaperType = {
  Continuous: 'Continuous',
  DieCut: 'DieCut',
} as const;

export type PrintPaperType = (typeof PrintPaperType)[keyof typeof PrintPaperType];

export interface PrintPaperConfig {
  type: PrintPaperType;
  paperSize: PaperSize;

  itemWidthMm?: number;
  itemHeightMm?: number;

  columns?: number;
  horizontalGapMm?: number;
  verticalGapMm?: number;

  cutterMode?: CutterMode;
}
```

## Responsibility

`PrintPaperConfig` dùng cho:

* layout;
* paper calculation;
* die-cut positioning;
* cutter behavior;
* print job configuration.

Không dùng nó để biểu diễn:

* printer hardware capability;
* supported paper size của physical printer;
* protocol capability.

---

# 11. PrintPaperConfig Rules

## Continuous

```ts
{
  type: PrintPaperType.Continuous,
  paperSize: PaperSize.Mm80,
}
```

`cutterMode` có thể được chỉ định.

Nếu không chỉ định:

```text
CutterMode.PerJob
```

được áp dụng.

## Die-cut

Die-cut không sử dụng cutter.

```text
cutterMode = CutterMode.None
```

Nếu caller truyền cutter configuration không phù hợp, validation phải xử lý.

## Die-cut columns

`columns` chỉ có ý nghĩa với:

```ts
type === PrintPaperType.DieCut
```

Khi die-cut:

```text
rowWidth =
  columns × itemWidthMm
  + (columns - 1) × horizontalGapMm
```

Nếu:

```text
rowWidth > printableWidth
```

configuration không hợp lệ.

Business rule này phải nằm trong:

```text
paper/validation.ts
```

Không cố nhét toàn bộ rule vào type comment.

---

# 12. Printer Capabilities

`PrinterCapabilities` mô tả physical capability của printer.

Ví dụ:

```ts
export interface PrinterCapabilities {
  /** Máy in có dao cắt (phần cứng). */
  cutter: boolean;
}
```

Không merge với `PrintPaperConfig`.

So sánh:

```text
PrintPaperConfig
→ Job muốn in như thế nào?

PrinterCapabilities
→ Printer thực tế có khả năng gì?
```

---

# 13. Paper Module

```text
paper/
├── cutter.ts
├── paperSpec.ts
└── validation.ts
```

## `paperSpec.ts`

Chứa:

* paper dimensions;
* printable width;
* physical paper specification;
* calculations cần thiết.

## `cutter.ts`

Chứa cutter rules.

Ví dụ:

```text
Continuous + undefined cutter
→ PerJob

DieCut
→ None
```

## `validation.ts`

Chứa business validation:

* required fields;
* dimension validation;
* die-cut row overflow;
* invalid cutter configuration;
* paper compatibility.

Validation không nên được phân tán vào nhiều layer.

---

# 14. Rendering

Rendering strategy (`RenderMode`) là config dùng chung cho CẢ 2 protocol, nằm trong `PrinterDriver.config` (§9):

```ts
export const RenderMode = {
  Encoder: 'Encoder',
  Bitmap: 'Bitmap',
} as const;

export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];

export interface PrinterDriverConfig {
  renderMode: RenderMode;
}
```

Chỉ còn 2 render mode. TSPL đã bỏ TrueType/internal-font (xem lịch sử ở dưới) — TSPL LUÔN dùng `RenderMode.Bitmap`. ESC/POS chọn `Encoder` hoặc `Bitmap`. Việc "TSPL chỉ được `Bitmap`" được enforce ở `PrinterSchema.ts` (`superRefine`), không phải ở type, vì cả 2 driver dùng chung 1 `PrinterDriverConfig`.

## `Encoder`

Protocol encoder trực tiếp tạo command (ESC/POS only — qua `EPToolkit`, cần đúng codepage CP1258, không rasterize).

## `Bitmap`

Nội dung đã được render thành ảnh (PNG base64, `documents.image`) ở lớp trên; driver decode ảnh này thành monochrome 1-bit rồi gửi lệnh bitmap của protocol (`BITMAP` cho TSPL, tương ứng cho ESC/POS). Chậm hơn `Encoder` nhưng đúng trên mọi máy bất kể codepage.

---

# 15. Text Rendering Rules

Protocol codepage và font rendering là hai vấn đề khác nhau.

Nếu text đã được rasterize thành bitmap:

```text
Unicode text
    ↓
TrueType font
    ↓
Bitmap
    ↓
TSPL / ESC-POS
```

thì protocol không còn chịu trách nhiệm encode Unicode text.

Ví dụ Vietnamese:

```text
"Nước"
    ↓
Noto Sans / Unicode font
    ↓
bitmap
```

không phụ thuộc vào việc TSPL printer có Vietnamese codepage hay không.

---

# 16. TSPL TrueType Font (ĐÃ BỎ)

TSPL từng có kế hoạch hỗ trợ thêm `truetype`/`internalfont` render mode (font cài trên printer, `DOWNLOAD "<name>",<byteCount>` + `TsplFontManager`/`TsplFontConfig`/`TsplCodepage`). Feature này đã bị **xoá hoàn toàn** trước khi triển khai production — TSPL chỉ còn một render mode duy nhất: `RenderMode.Bitmap` (xem §14). Không có `TsplStrategyRegistry`, `TsplTrueTypeStrategy`, `TsplInternalFontStrategy` hay `utils/cp1258.ts` trong codebase hiện tại.

Lý do: rasterize sang bitmap ở lớp trên (canvas render Unicode/Vietnamese text → PNG) hoạt động đúng trên mọi máy TSPL bất kể firmware có hỗ trợ TrueType/codepage hay không, nên không cần thêm complexity của việc quản lý font cài trên printer.

---

# 17. Driver Structure

```text
drivers/
├── DriverCapabilities.ts
├── DriverRegistry.ts
├── escpos/
│   ├── EscPosDriver.ts
│   ├── EscPosBitmapEncoder.ts
│   ├── EscPosTextBuilder.ts
│   └── ...
│
└── tspl/
    ├── TsplDriver.ts
    ├── TsplEncoder.ts
    └── strategies/
        └── TsplBitmapStrategy.ts
```

Driver không biết printer được lưu ở đâu.

Driver không tự quyết định printer nào sẽ nhận job.

Driver chỉ xử lý print operation được giao cho nó.

---

# 18. ESC/POS Driver

ESC/POS driver chịu trách nhiệm:

* ESC/POS command generation;
* text encoding;
* barcode;
* QR;
* image;
* paper/cutter commands;
* interaction với ESC/POS library adapter.

ESC/POS library có singleton behavior theo connection namespace.

Do đó concurrency không được tự xử lý trong driver.

Concurrency được quản lý bởi:

```text
PrintScheduler
    ↓
PrinterConnectionLock
```

---

# 19. TSPL Driver

TSPL driver chịu trách nhiệm:

* TSPL command generation;
* `SIZE`;
* `GAP`;
* `CODEPAGE`;
* `TEXT`;
* `BARCODE`;
* `QRCODE`;
* `BITMAP`;
* rendering strategy (chỉ còn `TsplBitmapStrategy` — TrueType/internal-font đã bỏ, xem §16).

Bitmap flow:

```text
Image
 ↓
Decode
 ↓
Resize
 ↓
Grayscale
 ↓
1-bit bitmap
 ↓
Hardware transform
 ↓
TSPL BITMAP
```

XP-420B firmware có behavior khác với chuẩn bitmap thông thường.

Nếu firmware yêu cầu invert bitmap:

```ts
// XP-420B firmware expects inverted bitmap bits.
invertBitmap(bitmap);
```

Comment này cần tồn tại vì code tự nó không thể giải thích lý do inversion.

---

# 20. Transport

Transport chịu trách nhiệm gửi bytes qua:

```text
USB
Bluetooth
LAN
```

Transport không biết:

* Receipt;
* Label;
* TSPL layout;
* ESC/POS command semantics.

Transport chỉ biết byte stream.

Ví dụ contract:

```ts
export interface IPrinterTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
}
```

Higher-level TypeScript layer sử dụng:

```ts
Uint8Array
```

Native React Native bridge sử dụng:

```text
Base64
```

để truyền binary data qua JS/native boundary.

---

# 21. Native Boundary

Native Android code nằm dưới:

```text
adapters/native/
```

Không tạo top-level:

```text
native/
```

Native adapter chịu trách nhiệm:

* Android API;
* USB API;
* Bluetooth API;
* socket API;
* vendor SDK;
* binary conversion;
* native lifecycle.

TypeScript business code không trực tiếp sử dụng Android API.

---

# 22. Native API Comment Rule

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

Không cần:

```java
// Open USB connection.
connection = ...
```

Comment cần giải thích:

* Android-specific limitation;
* lifecycle constraint;
* permission behavior;
* vendor SDK quirk;
* non-obvious workaround;
* concurrency limitation.

---

# 23. Adapter Layer

```text
adapters/
├── IPrinterAdapter.ts
├── resolvePrinterAdapter.ts
├── library/
├── native/
└── vendor/
```

Adapter chịu trách nhiệm integration với external implementation.

Ví dụ:

```text
Driver
 ↓
Adapter
 ↓
Library / Native / Vendor SDK
```

Không đưa business rule vào adapter.

---

# 24. Connection Service

`PrinterConnectionService` chỉ chịu trách nhiệm connection lifecycle.

```ts
connect()
disconnect()
reconnect()
getStatus()
```

Không chịu trách nhiệm:

```text
print()
route()
schedule()
render()
encode()
save()
```

Print execution nằm ở:

```text
PrinterPrintService
```

---

# 25. PrinterConnectionLock

`PrinterConnectionLock` quản lý runtime resource concurrency.

```text
PrintScheduler
    ↓
PrinterConnectionLock
```

Lock sử dụng:

```text
resourceKey
```

không sử dụng:

```text
identityKey
```

Lý do:

```text
identityKey
→ physical identity

resourceKey
→ runtime concurrency boundary
```

Hai printer khác nhau có thể có cùng resource key.

Ví dụ:

```text
Printer A → escpos:bluetooth
Printer B → escpos:bluetooth
```

Hai printer này vẫn phải được serialize nếu underlying library có singleton scope.

---

# 26. Printing Services

## `PrintService`

Public entry point.

Ví dụ:

```ts
await printService.print(document);
```

Không chứa:

* device discovery;
* connection lifecycle;
* protocol encoding;
* low-level transport.

---

## `PrintRoutingService`

Xác định target printer.

Input:

```text
PrintContentType
Document
Printer configuration
```

Output:

```text
Selected printer targets
```

Routing phải kiểm tra:

* printer enabled;
* driver hỗ trợ content type;
* configuration hợp lệ.

---

## `PrintScheduler`

Chịu trách nhiệm:

* queue;
* ordering;
* concurrency;
* resource locking;
* job lifecycle.

Scheduler không encode protocol.

Scheduler không biết TSPL command.

Scheduler không biết ESC/POS command.

---

## `PrinterPrintService`

Đây là boundary thực thi print cho một printer cụ thể.

Responsibilities:

```text
load printer configuration
    ↓
select driver
    ↓
connect
    ↓
print
    ↓
disconnect/reuse connection
```

`PrinterPrintService` cũng xử lý:

```text
testPrint()
```

Không đưa print execution trở lại `PrinterConnectionService`.

---

# 27. Complete Print Flow

```text
PrintService
    ↓
PrintRoutingService
    ↓
resolve target printers
    ↓
PrintScheduler
    ↓
PrinterConnectionLock(resourceKey)
    ↓
PrinterPrintService
    ↓
PrinterConnectionService
    ↓
PrinterDriver
    ↓
Transport
    ↓
Native Adapter
    ↓
Android / SDK
```

Với nhiều target:

```text
Receipt
 ├── Printer A
 ├── Printer B
 └── Printer C
```

mỗi target tạo print job riêng.

Scheduler quyết định execution order và concurrency dựa trên `resourceKey`.

---

# 28. Print Failure Policy

POS print failure không được làm crash sales flow một cách không cần thiết.

Ví dụ public receipt printing:

```ts
printReceipt()
```

không throw error ra UI flow nếu application policy yêu cầu best-effort printing.

Lower-level layers vẫn phải trả structured error.

Ví dụ:

```text
Transport error
    ↓
Driver error
    ↓
PrinterPrintService
    ↓
Scheduler
    ↓
Logging / monitoring
```

Không swallow error ở mọi layer.

Chỉ public operation quyết định error policy phù hợp với POS flow.

---

# 29. Discovery

```text
discovery/
├── DeviceScanService.ts
├── NetworkInfoService.ts
├── PrinterDiscoveryService.ts
└── PrinterResolver.ts
```

## `DeviceScanService`

Scan physical devices:

```text
USB
Bluetooth
LAN discovery source
```

## `NetworkInfoService`

Network-related information cần cho discovery.

## `PrinterDiscoveryService`

Orchestrate identification.

Discovery thử candidate driver theo thứ tự:

```text
TSPL
↓
ESC/POS
```

TSPL được thử trước vì identification có thể sử dụng:

```text
~!T
```

USB limitation:

```text
identify() → null
```

vì native USB module không đảm bảo đọc response từ printer.

Discovery không được coi `null` là "không phải printer".

Nó có nghĩa:

```text
Unable to identify through this transport.
```

## `PrinterResolver`

Map physical identity vào printer configuration.

Responsibilities:

* build `identityKey`;
* tìm existing printer;
* detect duplicate;
* resolve configuration.

---

# 30. Permissions

```text
permissions/
└── PrinterPermissionService.ts
```

Chỉ xử lý platform permission.

Không đưa permission checking vào:

```text
Driver
Transport
PrintService
```

trừ khi operation thực sự cần một permission cụ thể ở platform boundary.

---

# 31. Configuration Management

```text
management/
└── PrinterConfigService.ts
```

Chịu trách nhiệm:

* add printer;
* update printer;
* remove printer;
* enable/disable;
* validate configuration trước khi lưu.

Không chịu trách nhiệm:

* physical discovery;
* actual printing;
* queue;
* transport.

---

# 32. Storage

```text
storage/
├── PrinterRepository.ts
├── PrinterStorage.ts
└── PrinterWriteInput.ts
```

## `PrinterRepository`

Persistence boundary.

Ví dụ:

```ts
interface PrinterRepository {
  getAll(): Promise<Printer[]>;
  getById(id: string): Promise<Printer | undefined>;
  save(printer: PrinterWriteInput): Promise<void>;
  delete(id: string): Promise<void>;
}
```

## `PrinterStorage`

MMKV implementation.

Storage implementation không được leak ra domain layer.

## `PrinterWriteInput`

Input dành cho persistence write.

Không sử dụng native runtime object trong Redux hoặc persistent storage.

---

# 33. Storage Versioning

Printer storage sử dụng version.

Khi data model thay đổi breaking:

```text
storage version bump
```

Nếu migration không được hỗ trợ:

```text
destructive reset
```

Không cố migrate old printer data nếu migration không nằm trong scope.

---

# 34. State Management

Redux chỉ lưu serializable configuration/state.

Không lưu:

```text
UsbDevice
UsbDeviceConnection
Socket
Bluetooth runtime object
Native SDK instance
Transport instance
Driver runtime instance
```

Runtime objects phải nằm trong service/driver/transport lifecycle.

---

# 35. Logging

```text
logging/
└── PrinterLogger.ts
```

Logging phải có structured context.

Ví dụ:

```ts
logger.error('printer.print.failed', {
  printerId,
  driverType,
  connectionType,
  errorCode,
});
```

Không log binary payload lớn nếu không cần thiết.

Không log credential hoặc sensitive network information nếu không cần thiết.

---

# 36. Errors

```text
errors/
└── PrinterError.ts
```

Printer errors nên có stable error code.

Ví dụ:

```text
PRINTER_NOT_FOUND
PRINTER_NOT_CONFIGURED
PRINTER_CONNECTION_FAILED
PRINTER_WRITE_FAILED
PRINTER_TIMEOUT
PRINTER_UNSUPPORTED_CONTENT
TSPL_FONT_INSTALL_FAILED
```

Error code phục vụ:

* logging;
* diagnostics;
* UI mapping;
* monitoring;
* testing.

Không dùng error message làm machine-readable identifier.

---

# 37. TypeScript Readability Rules

## 37.1 Main flow phải nhìn thấy được

Ưu tiên:

```ts
const printer = await getPrinter(printerId);

if (!printer) {
  return;
}

const driver = resolveDriver(printer, contentType);

if (!driver) {
  return;
}

await driver.print(document);
```

hơn một function wrapper chain khó trace.

---

# 38. Guard Clause

Ưu tiên early return.

Không nên:

```ts
if (printer) {
  if (printer.enabled) {
    if (driver) {
      await driver.print(document);
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

if (!driver) {
  return;
}

await driver.print(document);
```

Mục tiêu:

```text
nesting <= 2 levels
```

Nếu vượt quá, xem xét refactor.

---

# 39. Function Responsibility

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

# 40. Class Responsibility

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

# 41. Naming

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

# 42. Condition Naming

Condition phức tạp nên được đặt tên nếu business meaning không rõ.

Ví dụ:

```ts
const canPrintReceipt =
  printer.enabled &&
  printer.type === PrintType.Receipt;

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

# 43. Comments

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

# 44. Field Comment Rules

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
   * Stable key used to identify the physical printer
   * and prevent duplicate configuration.
   */
  identityKey: string;

  /**
   * Runtime resource boundary used to serialize operations
   * that cannot safely execute concurrently.
   */
  resourceKey: string;
}
```

Không viết:

```ts
/** String containing printer ID. */
id: string;
```

---

# 45. Field Invariant

Nếu invariant đơn giản, có thể comment ngay tại field.

Ví dụ:

```ts
interface PrintPaperConfig {
  type: PrintPaperType;

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
paper/validation.ts
```

---

# 46. Comment WHAT vs WHY

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

# 47. Business Rule Comment

Có thể comment business rule khi rule không thể hiện rõ từ code.

```ts
// Receipt printing is best-effort so a printer failure does not block checkout completion.
await printReceipt(order);
```

---

# 48. Constraint Comment

```ts
// The underlying ESC/POS library uses a shared Bluetooth connection scope.
// Concurrent writes must therefore be serialized.
await connectionLock.runExclusive(resourceKey, () =>
  driver.print(document),
);
```

---

# 49. Workaround Comment

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

# 50. No Obvious Comments

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

# 51. No Comment-Based Complexity

Không dùng comment để hợp thức hóa code khó đọc.

Không nên:

```ts
// Check whether printer can receive receipt jobs.
if (
  printer &&
  printer.enabled &&
  printer.type === PrintType.Receipt &&
  printer.driver.type === PrinterDriverType.EscPos
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

# 52. Side Effects

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

# 53. Abstraction Rules

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

# 54. No Meaningless Wrapper

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

# 55. Không Over-Abstraction Printer Architecture

Không tạo:

```text
PrintManager
PrinterManager
PrinterFactory
DriverFactory
TransportFactory
GenericRenderer
GenericPrinterService
```

chỉ để điều phối các class hiện có.

Nếu resolver thực sự có responsibility:

```ts
resolvePrinterAdapter(...)
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

# 56. Dependency Direction

Dependency direction:

```text
UI
 ↓
Printing / Management
 ↓
Domain Models
 ↓
Drivers / Transports
 ↓
Adapters
 ↓
Native / Vendor SDK
```

Các layer phía trên không được phụ thuộc trực tiếp vào Android API.

Không cho phép:

```text
UI → Native SDK
Driver → MMKV
Transport → Redux
Storage → React Component
Native Adapter → PrintRoutingService
```

---

# 57. Testing Structure

Testing structure giữ nguyên:

```text
testing/
├── printerFixtures.ts
└── printerServiceTestKit.ts
```

Không đổi structure này chỉ để phù hợp một convention khác.

Existing:

```text
*.test.ts
```

giữ nguyên.

Test nên tập trung vào responsibility của component.

Ví dụ:

```text
PrintRoutingService
→ routing tests

PrintScheduler
→ ordering/concurrency tests

PrinterConnectionLock
→ resource locking tests

TsplDriver
→ encoding/rendering tests

paper/validation
→ paper rule tests
```

---

# 58. Testing Runtime Concurrency

Đặc biệt test các resource boundary:

```text
USB
→ shared resource

ESC/POS Bluetooth
→ shared ESC/POS resource

ESC/POS LAN
→ shared ESC/POS resource

TSPL Bluetooth
→ per-device resource

TSPL LAN
→ per-endpoint resource
```

Mục tiêu là đảm bảo hai jobs có cùng `resourceKey` không chạy đồng thời.

---

# 59. Printer Add Flow

Add Printer flow:

```text
Choose connection type
        ↓
Select device / enter IP + port
        ↓
Build identity
        ↓
Check duplicate
        ↓
Connect
        ↓
Discover / identify driver
        ↓
Resolve capabilities
        ↓
Test print
        ↓
Save configuration
```

Identity check phải xảy ra trước khi tạo duplicate connection configuration.

---

# 60. Discovery Driver Order

Candidate order:

```text
TSPL
↓
ESC/POS
```

Lý do:

TSPL identification có thể sử dụng command:

```text
~!T
```

USB không thể đảm bảo identification response vì native module không đọc response theo cách discovery yêu cầu.

Do đó:

```text
identify() === null
```

không đồng nghĩa:

```text
unsupported printer
```

mà là:

```text
unable to identify through this transport
```

---

# 61. Native Binary Contract

Application layer:

```ts
Uint8Array
```

Native bridge:

```text
Base64
```

Flow:

```text
Driver
 ↓
Uint8Array
 ↓
Adapter
 ↓
Base64
 ↓
React Native Bridge
 ↓
Android byte[]
```

Không expose Android `byte[]` trực tiếp lên TypeScript.

---

# 62. Vendor SDK Isolation

Vendor SDK phải được cô lập tại:

```text
adapters/vendor/
```

hoặc:

```text
adapters/native/
```

Driver không nên biết vendor-specific API.

Ví dụ:

```text
TsplDriver
    ↓
IPrinterAdapter
    ↓
NativeAdapter
    ↓
Android SDK
```

Driver chỉ biết contract mà adapter cung cấp.

---

# 63. Android API Rule

Các class sử dụng Android API phải nằm ở native/integration boundary.

Ví dụ:

```text
android.content.Context
android.hardware.usb.UsbDevice
android.hardware.usb.UsbManager
android.bluetooth.*
android.net.*
android.util.*
```

không được leak lên TypeScript domain/service layer.

Comment Android API chỉ thêm khi có behavior không hiển nhiên.

---

# 64. Runtime Object Rule

Không persist hoặc Redux-store runtime object.

Không lưu:

```text
UsbDevice
UsbDeviceConnection
UsbEndpoint
Socket
BluetoothSocket
SDK instance
Transport instance
Driver instance
```

Chỉ lưu serializable configuration:

```text
Printer
PrinterConnection
PrinterDriver configuration
PrinterCapabilities
PrintPaperConfig
```

---

# 65. Migration Rules

Khi refactor architecture:

```text
services/
```

được phân tách theo responsibility.

Mapping:

```text
services/PrinterLogger.ts
→ logging/PrinterLogger.ts

services/PrinterConnectionService.ts
→ connection/PrinterConnectionService.ts

services/PrinterConfigService.ts
→ management/PrinterConfigService.ts

services/device/DeviceScanService.ts
→ discovery/DeviceScanService.ts

services/device/NetworkInfoService.ts
→ discovery/NetworkInfoService.ts

services/discovery/PrinterDiscoveryService.ts
→ discovery/PrinterDiscoveryService.ts

services/discovery/PrinterResolver.ts
→ discovery/PrinterResolver.ts

services/permission/PrinterPermissionService.ts
→ permissions/PrinterPermissionService.ts

services/printing/PrintRoutingService.ts
→ printing/PrintRoutingService.ts

services/printing/PrintScheduler.ts
→ printing/PrintScheduler.ts

services/printing/PrintService.ts
→ printing/PrintService.ts

services/connection/PrinterConnectionLock.ts
→ connection/PrinterConnectionLock.ts
```

`PrinterPrintService.ts` là service mới được tạo để giữ print execution responsibility riêng biệt.

Sau migration:

```text
services/
```

được xóa.

---

# 66. Final Architecture Invariants

Các invariant sau phải được giữ:

### Printer

* Không có `isDefault`.
* Có `identityKey`.
* `identityKey` không dùng cho concurrency.
* Mỗi printer có ĐÚNG 1 `driver`, ĐÚNG 1 `connection`, ĐÚNG 1 `paper`, ĐÚNG 1 `type` cố định.
* Một physical printer phục vụ nhiều content type = nhiều `Printer` record cùng `identityKey`, khác `type`.
* Unique constraint là cặp `(identityKey, type)`.

### Drivers

* `EscPos` và `Tspl` là independent driver types.
* `DRIVER_CAPABILITIES` quyết định driver type nào CÓ THỂ phục vụ content type nào — enforce khớp với `printer.type` ở `PrinterSchema.ts`.
* Driver không quản lý persistence.
* Driver không quản lý routing.

### Connection

* `PrinterConnectionService` chỉ quản lý lifecycle.
* `PrinterConnectionLock` quản lý concurrency.
* `resourceKey` quyết định concurrency boundary.

### Printing

```text
PrintService
→ PrintRoutingService
→ PrintScheduler
→ PrinterPrintService
→ PrinterConnectionService
→ PrinterDriver
→ Transport
→ Native Adapter
```

### Paper

* Tên chính thức là `PrintPaperConfig`.
* Folder là `paper/`.
* `PrintPaperConfig` không đại diện physical capability.
* `PrinterCapabilities` không đại diện print-job configuration.
* Die-cut không dùng cutter.
* Continuous không khai báo cutter thì mặc định `CutterMode.PerJob`.
* Die-cut row overflow phải được validation.

### Rendering

* Chỉ có 2 render mode: `Encoder`, `Bitmap`.
* TSPL LUÔN dùng `Bitmap` (TrueType/internal-font đã bị xoá hoàn toàn — không phải spike, không tồn tại trong code).
* ESC/POS chọn `Encoder` hoặc `Bitmap`.

### Native

* Native code chỉ nằm ở adapter/native boundary.
* Binary từ TypeScript sử dụng `Uint8Array`.
* React Native bridge sử dụng Base64.
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

# 67. Pull Request Review Checklist

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

* [ ] Driver có chứa protocol logic thay vì orchestration không?
* [ ] Transport có chỉ xử lý byte transport không?
* [ ] Connection service có chỉ xử lý lifecycle không?
* [ ] Scheduler có chịu trách nhiệm concurrency không?
* [ ] `resourceKey` có được sử dụng cho locking không?
* [ ] `identityKey` có chỉ dùng cho physical identity không?
* [ ] Native/vendor SDK có bị leak lên business layer không?

---

# 68. Core Principle

> **Code dễ đọc trước, code ngắn sau.**

> **Tên rõ ràng trước, comment sau.**

> **Comment để giải thích mục đích, rule, constraint và WHY.**

> **Nesting càng ít càng tốt.**

> **Mỗi function/class chỉ nên có một trách nhiệm rõ ràng.**

> **Abstraction phải làm code dễ hiểu hơn, không phải khó hiểu hơn.**

> **Architecture được tổ chức theo responsibility, không theo số lượng pattern.**

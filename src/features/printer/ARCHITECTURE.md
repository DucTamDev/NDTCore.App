# Printer Feature — Production Architecture & Runtime Design

**Document Type:** Architecture Contract
**Status:** Production
**Scope:** `src/features/printer/` và các feature sử dụng printer
**Primary Platform:** React Native / Android
**Protocols:** TSPL, ESC/POS
**Connections:** USB, Bluetooth, LAN

---

# 1. Purpose

Tài liệu này định nghĩa architecture chính thức của Printer Feature.

Tài liệu mô tả:

* architecture layers
* module boundaries
* responsibility của từng file
* printer data model
* driver model
* protocol discovery
* TSPL rendering
* TrueType font lifecycle
* bitmap rendering
* transport
* connection lifecycle
* print routing
* print scheduling
* concurrency
* error handling
* persistence
* logging
* testing
* SOLID principles
* production invariants

Đây là **architecture contract**.

Implementation phải tuân thủ contract này.

> **Cập nhật 2026-08 — tầng `IPrinterAdapter`.** ESC/POS và TSPL giờ đi qua
> `adapters/IPrinterAdapter` (`listDevices`/`connect`/`write`/`printText`/`read`/
> `disconnect`) thay vì gọi thẳng namespace/transport. 3 impl theo nguồn cơ chế:
> `NativeAdapter` (native module RN\*Printer), `LibraryAdapter` (tcp-socket /
> bluetooth-classic, bọc `LanTransport`/`BluetoothTransport`), `VendorAdapter`
> (skeleton). `resolvePrinterAdapter(driverType, connectionType)`: ESC/POS →
> Native; TSPL/USB → Native; TSPL/BLE-LAN → Library. `transports/*Transport` giữ
> nguyên làm building-block nội bộ của adapter. Các mục nói "ESC/POS vendor
> library" / "TsplTransport" bên dưới mô tả trạng thái trước thay đổi này.

---

# 2. Non-Goals

Printer Feature không chịu trách nhiệm:

* payment
* order lifecycle
* cart state
* business calculation
* invoice calculation
* kitchen business rules
* inventory
* customer data
* printer UI business ngoài printer configuration

Printer Feature chỉ cung cấp printer capability cho các feature khác.

---

# 3. High-Level Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        Application                           │
│                                                              │
│  Printer Management       Cart       Order       Kitchen     │
└───────────────┬──────────────┬───────────────┬──────────────┘
                │              │               │
                │              │               │
                ▼              ▼               ▼
        PrinterService     PrintService     PrintService
                │              │
                │              ▼
                │       PrintRoutingService
                │              │
                │              ▼
                │       PrintScheduler
                │              │
                │              ▼
                │    PrinterConnectionLock
                │              │
                ▼              ▼
        DriverRegistry    Printer Drivers
                │              │
                │        ┌─────┴─────┐
                │        ▼           ▼
                │    TsplDriver   EscPosDriver
                │        │
                │        ▼
                │   TSPL Strategy
                │    ┌────┴────┐
                │    ▼         ▼
                │ Bitmap     TrueType
                │
                ▼
          Transport Layer
          ┌─────┼─────┐
          ▼     ▼     ▼
         USB    BT    LAN
          │     │     │
          └─────┼─────┘
                ▼
           Native Layer
                ▼
             Printer
```

---

# 4. Fundamental Architecture Rule

Application code không được biết implementation của printer.

Không được:

```text
Cart
 ↓
RNUSBPrinter
```

Không được:

```text
AddPrinterModal
 ↓
PrinterNativeModule
```

Không được:

```text
OrderPrintTrigger
 ↓
TsplEncoder
```

Đúng:

```text
Application
    ↓
PrinterService / PrintService
    ↓
Driver
    ↓
Strategy / Encoder
    ↓
Transport
    ↓
Native
```

---

# 5. Two Entry Points

Có hai entry point chính.

## Management entry point

Dùng cho:

* scan
* discovery
* connect
* disconnect
* configure
* test print
* install font
* save printer

```text
UI
 ↓
PrinterService
```

## Production printing entry point

Dùng khi application cần in:

```text
Cart / Order
 ↓
PrintService
```

Không dùng `PrinterService.print()` trực tiếp từ business feature.

---

# 6. PrinterService

`PrinterService` là **Facade** của Printer Feature.

Responsibility:

```text
CRUD
connect
disconnect
status
discovery
test print
font installation
manual driver selection
```

Ví dụ:

```ts
interface PrinterService {
  getPrinters(): Printer[];

  addPrinter(input: AddPrinterInput): Promise<Printer>;

  updatePrinter(
    printerId: string,
    input: UpdatePrinterInput,
  ): Promise<Printer>;

  removePrinter(
    printerId: string,
  ): Promise<void>;

  connect(
    printerId: string,
  ): Promise<void>;

  disconnect(
    printerId: string,
  ): Promise<void>;

  getStatus(
    printerId: string,
  ): PrinterStatus;

  discoverDriver(
    input: DiscoveryInput,
    onEvent?: DiscoveryListener,
  ): Promise<DiscoveryResult>;

  testPrint(
    printer: Printer,
    driver: PrinterDriver,
    documents: PrintDocuments,
    printType: PrintType,
  ): Promise<void>;

  installTsplFont(
    printerId: string,
    config: TsplFontConfig,
  ): Promise<void>;
}
```

---

# 7. PrintService

`PrintService` là entry point dành cho application printing.

```ts
print(
  printType: PrintType,
  documents: PrintDocuments,
): Promise<PrintResult>;
```

`PrintService` không biết:

* USB implementation
* Bluetooth implementation
* native module
* TSPL command
* ESC/POS command
* TTF binary
* bitmap algorithm

---

# 8. Print Pipeline

Production print pipeline:

```text
Print request
     ↓
Routing
     ↓
Target resolution
     ↓
Image requirement analysis
     ↓
Document preparation
     ↓
Scheduler
     ↓
Resource lock
     ↓
Driver
     ↓
Strategy
     ↓
Encoder
     ↓
Transport
     ↓
Printer
```

---

# 9. PrintType

`PrintType` mô tả **business content**.

```ts
type PrintType =
  | 'Receipt'
  | 'Label';
```

Codebase khai báo bằng const-object pattern:
`export const PrintType = { Receipt: 'Receipt', Label: 'Label' } as const`
kèm derived type `type PrintType = (typeof PrintType)[keyof typeof PrintType]`.
Giá trị chuỗi `'Receipt' | 'Label'` không đổi — xem
`types/printConfiguration.types.ts`.

Ví dụ:

```text
Receipt
    → hóa đơn

Label
    → tem sản phẩm
```

---

# 10. PrinterDriverType

`PrinterDriverType` mô tả **printer protocol**.

```ts
type PrinterDriverType =
  | 'escpos'
  | 'tspl';
```

Hai concept không được merge.

---

# 11. PrintType ≠ Protocol

Không được hard-code:

```text
Receipt = ESC/POS
Label   = TSPL
```

Có thể:

```text
TSPL → Receipt
TSPL → Label
ESC/POS → Receipt
ESC/POS → Label
```

miễn là driver capability cho phép.

---

# 12. Driver Capability

Mỗi driver khai báo content type mà nó nhận.

```ts
interface PrinterDriver {
  type: PrinterDriverType;

  contentTypes: PrintType[];

  ...
}
```

Ví dụ:

```json
{
  "type": "tspl",
  "contentTypes": ["Receipt"]
}
```

hoặc:

```json
{
  "type": "tspl",
  "contentTypes": ["Label"]
}
```

---

# 13. Printer Entity

```ts
interface Printer {
  id: string;

  name: string;

  vendor?: string;

  model?: string;

  drivers: PrinterDriver[];

  connectionType:
    | 'usb'
    | 'bluetooth'
    | 'lan';

  device?: PrinterDevice;

  lan?: PrinterLanConfig;

  identityKey: string;

  capabilities: PrinterCapabilities;

  autoReconnect: boolean;

  enabled: boolean;

  createdAt: string;

  updatedAt: string;
}
```

`capabilities` mô tả phần cứng máy in (vd có dao cắt hay không). Khổ giấy + layout
(`media: PrintMedia`) KHÔNG nằm trên `Printer` — mỗi driver có `media` riêng trong
`PrinterDriver.config`, vì cùng 1 máy in có thể chạy ESC/POS trên giấy cuộn và TSPL
trên tem die-cut cùng lúc.

---

# 14. PrinterDriver Entity

```ts
interface PrinterDriver {
  type:
    | 'escpos'
    | 'tspl';

  source:
    | 'auto'
    | 'manual';

  contentTypes: PrintType[];

  config:
    | TsplDriverConfig
    | EscPosDriverConfig;
}
```

---

# 15. Printer Invariant

Một printer có:

```text
1 → 2 drivers
```

Tối đa:

```text
1 ESC/POS
1 TSPL
```

Không được:

```text
TSPL
TSPL
```

---

# 16. ContentType Invariant

Một content type chỉ được route tới **một driver** trong cùng printer.

Không được:

```text
ESC/POS → Receipt
TSPL    → Receipt
```

trên cùng physical printer.

Điều này tránh ambiguity khi routing.

---

# 17. Connection Invariant

Nếu:

```text
connectionType = usb
```

phải có:

```text
device
```

và không có:

```text
lan
```

Tương tự Bluetooth.

LAN:

```text
connectionType = lan
```

phải có:

```text
lan
```

và không có:

```text
device
```

---

# 18. IdentityKey

`identityKey` định danh physical printer.

Nó phụ thuộc:

```text
connectionType
+
physical connection identity
```

Không phụ thuộc:

```text
driver
protocol
renderMode
PrintType
font
```

---

# 19. Identity Example

Một printer USB:

```text
USB + device-A
```

sau khi user chọn:

```text
TSPL
```

vẫn giữ nguyên:

```text
identityKey = USB/device-A
```

Nếu đổi:

```text
TSPL → ESC/POS
```

identity không đổi.

---

# 20. Duplicate Prevention

Khi add printer:

```text
calculate identityKey
        ↓
find existing
        ↓
exists?
 ├── YES → reject
 └── NO  → save
```

Không dựa vào:

```text
name
vendor
model
protocol
```

để xác định duplicate.

---

# 21. Runtime State

Không lưu trong `Printer`:

```text
connected
connecting
offline
error
```

Runtime state nằm trong driver/service.

UI nhận event:

```ts
onStatusChange()
```

---

# 22. Status Architecture

```text
Native
 ↓
Transport / Adapter
 ↓
Driver
 ↓
PrinterService
 ↓
onStatusChange
 ↓
usePrinterConnection
 ↓
Redux
 ↓
UI
```

Không polling.

---

# 23. Driver Interface

```ts
interface IPrinterDriver {
  scan(
    connectionType: ConnectionType,
    onEvent: (event: DeviceScanEvent) => void,
  ): Unsubscribe;

  connect(
    printer: Printer,
    driver: PrinterDriver,
  ): Promise<void>;

  disconnect(printerId: string): Promise<void>;

  getStatus(printerId: string): PrinterStatus;

  onStatusChange(
    printerId: string,
    callback: (status: PrinterStatus) => void,
  ): Unsubscribe;

  identify(printerId: string): Promise<PrinterDeviceInfo | null>;

  print(
    printerId: string,
    documents: PrintDocuments,
    printType: PrintType,
  ): Promise<void>;

  testPrint(
    printer: Printer,
    driver: PrinterDriver,
    documents: PrintDocuments,
    printType: PrintType,
  ): Promise<void>;
}
```

Pseudocode gốc §23 là minh hoạ; signature chuẩn xem `types/driver.types.ts`.
Điểm khác với pseudocode:

* **KHÔNG có `encode()`** — render TSPL nằm ở strategy (§27-30), ESC/POS ở builder (§111).
* `printType: PrintType` là **bắt buộc** trên `print()` / `testPrint()`.
* `scan` là streaming: `scan(connectionType, onEvent): Unsubscribe` — không phải `Promise<PrinterDevice[]>` — để huỷ được stream discovery Bluetooth ~12s.
* `connect(printer, driver)` — 1 `Printer` có ≤ 2 driver, mỗi driver connect bằng config/transport riêng.
* `disconnect` / `getStatus` / `onStatusChange` / `identify` nhận `printerId`.

---

# 24. DriverRegistry

```text
DriverRegistry
 ├── escpos → EscPosDriver
 └── tspl   → TsplDriver
```

Responsibility:

> Resolve protocol → driver implementation.

Không chịu trách nhiệm:

* routing
* storage
* discovery logic
* print scheduling

---

# 25. TSPL Driver

`TsplDriver` là orchestration layer cho TSPL.

```text
TsplDriver
 ├── Transport
 ├── StrategyRegistry
 ├── TsplFontManager
 ├── TsplEncoder
 └── status lifecycle
```

---

# 26. TsplDriver Không Render

`TsplDriver` không được chứa:

```text
PNG decoding
RGBA conversion
TTF parsing
bitmap algorithm
```

Nó chỉ:

```text
validate
resolve strategy
execute strategy
send bytes
```

---

# 27. TSPL Strategy Pattern

TSPL có nhiều rendering mode.

```text
TsplDriver
      ↓
TsplStrategyRegistry
      ↓
┌───────────────────────┐
│                       │
▼                       ▼
BitmapStrategy     TrueTypeStrategy
```

---

# 28. Strategy Interface

```ts
interface ITsplPrintStrategy {
  readonly mode: TsplRenderMode;

  validate(
    context: TsplStrategyContext,
  ): void;

  encode(
    context: TsplStrategyContext,
  ): Uint8Array;
}
```

Strategy chỉ chịu trách nhiệm:

```text
document
 ↓
TSPL representation
```

---

# 29. TsplRenderMode

```ts
type TsplRenderMode =
  | 'bitmap'
  | 'truetype';
```

---

# 30. Strategy Registry

```text
TsplStrategyRegistry
       │
       ├── bitmap
       │     → TsplBitmapStrategy
       │
       └── truetype
             → TsplTrueTypeStrategy
```

Không switch logic lớn trong `TsplDriver`.

Không:

```ts
if (renderMode === 'bitmap') {
  ...
} else if (renderMode === 'truetype') {
  ...
}
```

với toàn bộ implementation nằm trong driver.

---

# 31. Bitmap Strategy

Bitmap strategy:

```text
PrintDocument
 ↓
PNG
 ↓
Decode
 ↓
Resize
 ↓
Monochrome
 ↓
TSPL BITMAP
```

---

# 32. Bitmap Input

Bitmap mode yêu cầu:

```ts
documents.image
```

Nếu không có:

```text
TSPL_IMAGE_REQUIRED
```

---

# 33. Bitmap Không Fallback

Không được:

```text
image missing
 ↓
TEXT
```

Không được:

```text
bitmap conversion failed
 ↓
TEXT
```

Không được:

```text
image too large
 ↓
TEXT
```

Tất cả đều:

```text
FAIL
```

---

# 34. Bitmap Width

Image phải được resize theo paper width.

Ví dụ:

```text
58mm → configured pixel width
80mm → configured pixel width
```

Không gửi image arbitrary width xuống printer.

---

# 35. Bitmap Conversion

Pipeline:

```text
PNG Base64
    ↓
UPNG decode
    ↓
RGBA
    ↓
Resize
    ↓
Brightness threshold
    ↓
1-bit bitmap
    ↓
TSPL BITMAP payload
```

---

# 36. Monochrome Rule

Output phải là:

```text
1 bit / pixel
```

Không gửi:

```text
RGBA
RGB
PNG
```

trực tiếp trong TSPL `BITMAP`.

---

# 37. Bitmap Firmware Quirk

Một số Xprinter-compatible firmware có bit interpretation khác TSPL2 expectation.

Implementation giữ transformation:

```text
byte ^ 0xff
```

tại bitmap encoder boundary.

Không để quirk lan sang:

```text
document
renderer
strategy interface
```

---

# 38. Bitmap Height

Trước khi encode:

```text
image height
    ≤
declared print area height
```

Nếu vượt:

```text
TSPL_IMAGE_TOO_LARGE
```

Không tự động crop.

Không tự động shrink height ngoài rule resize đã định nghĩa.

---

# 39. TrueType Strategy

TrueType strategy:

```text
PrintDocument
 ↓
text
 ↓
custom TSPL font
 ↓
TEXT
 ↓
PRINT
```

---

# 40. TrueType Preconditions

TrueType chỉ được execute khi:

```text
renderMode = truetype
```

và:

```text
fontInstalled = true
```

Nếu không:

```text
TSPL_FONT_NOT_INSTALLED
```

---

# 41. TrueType Không Fallback

Nếu:

```text
fontInstalled = false
```

không được:

```text
BitmapStrategy
```

Nếu:

```text
TEXT encode failed
```

không được:

```text
BitmapStrategy
```

Nếu:

```text
font unavailable
```

không được:

```text
built-in font
```

Kết quả:

```text
PRINT FAILED
```

---

# 42. TrueType Print Payload

TrueType print chỉ gửi:

```text
TSPL TEXT
```

và:

```text
PRINT
```

Không gửi font binary trong print job.

---

# 43. Critical Rule — DOWNLOAD

`DOWNLOAD` không phải print command.

`DOWNLOAD` là:

```text
font installation command
```

Do đó:

```text
Font Installation
    → DOWNLOAD
```

nhưng:

```text
Print
    → không DOWNLOAD
```

---

# 44. Font Lifecycle

Font lifecycle:

```text
Bundled TTF
     ↓
Font Manager
     ↓
Read bytes
     ↓
Build DOWNLOAD
     ↓
Transport
     ↓
Printer storage
```

Đây là lifecycle riêng.

---

# 45. Font Installation API

```ts
installTsplFont(
  printerId: string,
  config: TsplFontConfig,
): Promise<void>
```

Không gọi thông qua:

```ts
print()
```

---

# 46. Font Installation Flow

```text
User
 ↓
Install Font
 ↓
PrinterService
 ↓
Lock
 ↓
TsplFontManager
 ↓
Connect
 ↓
Read bundled TTF
 ↓
Build DOWNLOAD
 ↓
Write bytes
 ↓
Installation success
 ↓
Disconnect
 ↓
Persist state
```

---

# 47. Font Installation Không Chạy Khi Print

Print:

```text
TsplDriver.print()
```

không được gọi:

```text
TsplFontManager.install()
```

Không có:

```text
downloadFont()
```

trong print path.

Đây là rule bắt buộc.

---

# 48. Không DOWNLOAD Khi Reconnect

Reconnect chỉ:

```text
connect
```

Không:

```text
connect
 ↓
DOWNLOAD
```

---

# 49. Không DOWNLOAD Khi Test Print

Test print phải test chính xác production rendering.

TrueType test:

```text
connect
 ↓
TEXT
 ↓
PRINT
```

Không:

```text
DOWNLOAD
 ↓
TEXT
 ↓
PRINT
```

---

# 50. Font State

```ts
interface TsplFontConfig {
  name: string;

  fileName: string;

  fontInstalled: boolean;
}
```

`renderMode` KHÔNG thuộc `TsplFontConfig` — nó thuộc `TsplDriverConfig`
(§14, §29). `name` là định danh logical dùng chung cho `DOWNLOAD "<name>"`
và `TEXT ...,"<name>"`; `fileName` là tên file `.ttf` trong assets.

`fontInstalled` là application state.

Không phải hardware verification.

---

# 51. Hardware Font Verification

Nếu printer không cung cấp API query installed fonts:

```text
fontInstalled = true
```

chỉ có nghĩa:

> Installation operation trước đó đã thành công.

Không có nghĩa:

> Font chắc chắn vẫn còn trong printer.

---

# 52. Font Loss

Nếu printer firmware mất font sau:

* power cycle
* factory reset
* firmware update
* volatile storage reset

application có thể không biết.

Không tự động:

```text
DOWNLOAD
```

ở print time.

User phải explicit reinstall.

---

# 53. Font Manager Responsibility

`TsplFontManager` chỉ chịu trách nhiệm:

```text
TTF asset
 ↓
raw bytes
 ↓
DOWNLOAD
```

Không chịu trách nhiệm:

* receipt
* label
* routing
* print scheduler
* bitmap
* UI

---

# 54. TsplEncoder

`TsplEncoder` là low-level TSPL command builder.

```text
SIZE
GAP
CODEPAGE
CLS
TEXT
BITMAP
BARCODE
QRCODE
PRINT
```

---

# 55. Encoder Không Connect

`TsplEncoder` không được:

```text
connect()
disconnect()
```

Không được gọi:

```text
native module
```

Không được đọc:

```text
MMKV
```

---

# 56. Transport

TSPL transport abstraction:

```ts
interface ITransport {
  connect(): Promise<void>;

  disconnect(): Promise<void>;

  write(data: Uint8Array): Promise<void>;

  read?(): Promise<Uint8Array>;
}
```

---

# 57. Transport Implementations

```text
Transport
 ├── UsbTransport
 ├── BluetoothTransport
 └── LanTransport
```

---

# 58. USB Transport

USB transport chịu trách nhiệm:

```text
device
 ↓
native USB
 ↓
bulk OUT
```

Không chịu trách nhiệm:

```text
TSPL syntax
font
bitmap
routing
```

---

# 59. Bluetooth Transport

Bluetooth:

```text
device
 ↓
socket/native transport
 ↓
raw bytes
```

---

# 60. LAN Transport

LAN:

```text
IP + port
 ↓
TCP connection
 ↓
raw bytes
```

---

# 61. Adapter Boundary

ESC/POS sử dụng vendor thermal printer library.

```text
EscPosDriver
    ↓
ThermalPrinterAdapter
    ↓
Vendor Library
    ↓
Native
```

TSPL sử dụng raw transport.

```text
TsplDriver
    ↓
Transport
    ↓
Native
```

---

# 62. Native Boundary

Chỉ các module sau được phép biết native:

```text
PrinterNativeModule
ThermalPrinterAdapter
Transport implementations
```

Các layer phía trên không được import native modules.

---

# 63. Discovery Architecture

Discovery:

```text
PrinterDiscoveryService
        ↓
DriverRegistry
        ↓
candidate drivers
```

Candidate:

```ts
[
  'tspl',
  'escpos'
]
```

---

# 64. Discovery Flow

```text
User selects connection
       ↓
Device selected
       ↓
PrinterService.discoverDriver()
       ↓
PrinterDiscoveryService
       ↓
TSPL connect
       ↓
TSPL identify
       ↓
success?
 ├── YES → identified
 └── NO
       ↓
ESC/POS connect
       ↓
ESC/POS identify
       ↓
success?
 ├── YES → identified
 └── NO → unknown_protocol
```

---

# 65. Discovery Must Use Real Device

Không chỉ kiểm tra:

```text
device.name
```

Không chỉ kiểm tra:

```text
vendor
```

Không chỉ kiểm tra:

```text
model
```

Phải dùng:

```text
connect()
+
identify()
```

nếu protocol hỗ trợ.

---

# 66. TSPL Identify

TSPL identify sử dụng discriminator thực.

Ví dụ:

```text
~!T
```

Driver gửi raw command.

Nếu response hợp lệ:

```text
identified = tspl
```

---

# 67. ESC/POS Identify

Nếu ESC/POS implementation không có protocol discriminator thực:

```text
connect success
```

không đồng nghĩa:

```text
protocol confirmed
```

Do đó discovery phải tôn trọng capability của driver.

---

# 68. USB Discovery Limitation

USB native module hiện tại chỉ hỗ trợ:

```text
bulk OUT
```

không đọc response.

Do đó:

```text
identify() → null
```

cho USB.

---

# 69. USB Unknown Protocol

USB flow:

```text
scan
 ↓
device selected
 ↓
connect
 ↓
identify = null
 ↓
unknown_protocol
```

UI phải cho phép:

```text
Printer Language
 ├── TSPL
 └── ESC/POS
```

---

# 70. No Vendor/Model Rule Table

Không được dùng:

```text
Xprinter XP-420B → TSPL
```

làm protocol truth.

Vendor/model chỉ là metadata.

Protocol truth đến từ:

```text
identify()
```

hoặc manual configuration.

---

# 71. Manual Driver Selection

Khi discovery không xác định được protocol:

```text
User
 ↓
select TSPL / ESC/POS
 ↓
source = manual
```

Persist:

```ts
source: 'manual'
```

---

# 72. Automatic Driver Selection

Nếu protocol được xác định:

```ts
source: 'auto'
```

Ví dụ:

```json
{
  "type": "tspl",
  "source": "auto"
}
```

---

# 73. Add Printer Flow

```text
Open Add Printer
       ↓
Select connection type
       ↓
Scan / configure device
       ↓
Connect
       ↓
Discover protocol
       ↓
identified / unknown
       ↓
Configure driver
       ↓
Configure PrintType
       ↓
Configure paper
       ↓
Optional TrueType setup
       ↓
Test Print
       ↓
Validate
       ↓
Identity check
       ↓
Save
```

---

# 74. Save Flow

```text
PrinterInfoCard
 ↓
PrinterService.addPrinter()
 ↓
Zod validation
 ↓
identityKey
 ↓
duplicate check
 ↓
storage
```

Không save invalid object.

---

# 75. Storage

Storage:

```text
PrinterStorage
```

dùng MMKV.

Storage chịu trách nhiệm:

```text
serialize
deserialize
save
update
remove
get
```

---

# 76. Storage Version

Có:

```ts
CURRENT_STORAGE_VERSION
```

Nếu shape incompatible:

```text
version++
```

và destructive reset.

Không migrate từng field.

---

# 77. Production Print Routing

Routing:

```text
PrintType
      ↓
PrintRoutingService
      ↓
enabled printers
      ↓
drivers containing PrintType
      ↓
targets
```

---

# 78. Routing Result

```ts
interface PrintTarget {
  printer: Printer;

  driver: PrinterDriver;
}
```

---

# 79. Example Routing

```text
Receipt
 │
 ├── Printer A / ESC/POS
 ├── Printer B / TSPL
 └── Printer C / TSPL
```

Nếu cả ba đều:

```text
enabled = true
contentTypes includes Receipt
```

thì cả ba đều nhận job.

---

# 80. Image Requirement Resolution

Trước khi capture image:

```text
resolveTargets()
      ↓
contains TSPL bitmap target?
```

Nếu:

```text
NO
```

không capture.

Nếu:

```text
YES
```

capture image.

---

# 81. Why Capture Happens Before Driver

Image capture là application/document preparation.

Driver không được:

```text
render React component
```

Driver chỉ nhận:

```text
PrintDocuments
```

---

# 82. BillImageCapture

```text
BillImagePreview
       ↓
captureRef()
       ↓
PNG base64
```

Component này chỉ được execute khi routing xác định cần bitmap.

---

# 83. PrintDocuments

Ví dụ:

```ts
interface PrintDocuments {
  text: PrintDocument;

  image?: string;
}
```

`text` **bắt buộc** trong codebase (mọi flow đều có document text); `image`
là base64 PNG **không** tiền tố `data:` — nguồn cho TSPL bitmap.

Strategy quyết định document nào được sử dụng.

---

# 84. PrintScheduler

Scheduler quản lý:

```text
job lifecycle
queue
execution
retry policy
lock
```

Không quản lý:

```text
TSPL syntax
image conversion
font installation
```

---

# 85. Print Job

```ts
interface PrintJob {
  id: string;

  requestId: string;

  printerId: string;

  printType: PrintType;

  documents: PrintDocuments;

  status: PrintJobStatus;

  retryCount: number;

  error?: PrinterError;

  createdAt: string;

  startedAt?: string;

  completedAt?: string;
}
```

`driverType` **không** lưu trên job — `PrintScheduler` tự tra driver từ
`printer + printType` (`resourceKeyFor`); thêm field là trùng nguồn sự thật.
`requestId` gộp các job multi-target sinh từ 1 lệnh `PrintService.print`
(cần cho failure isolation §128-129). `status` / `retryCount` / `*At` là
scheduler lifecycle (§86, §94).

---

# 86. Scheduler Flow

```text
enqueue(job)
    ↓
resolve resourceKey
    ↓
acquire lock
    ↓
connect if required
    ↓
driver.print()
    ↓
release lock
```

---

# 87. PrinterConnectionLock

Lock bảo vệ **native resource**, không phải logical printer.

API:

```ts
runExclusive(
  resourceKey: string,
  operation: () => Promise<void>,
): Promise<void>
```

---

# 88. USB Resource

USB:

```text
resourceKey = "usb"
```

Global singleton.

Do đó:

```text
USB Printer A
USB Printer B
```

không chạy native operation đồng thời.

---

# 89. ESC/POS Resource

ESC/POS vendor library:

```text
escpos:usb
escpos:bluetooth
escpos:lan
```

theo native singleton boundary thực tế của library.

---

# 90. TSPL Resource

TSPL custom transport:

```text
tspl:usb
```

cho USB.

LAN:

```text
tspl:lan:<ip>:<port>
```

Bluetooth:

```text
tspl:bluetooth:<deviceId>
```

---

# 91. Parallel Printing

TSPL LAN:

```text
Printer A
resource = tspl:lan:A

Printer B
resource = tspl:lan:B
```

Có thể:

```text
A ────────────►
B ────────────►
```

song song.

---

# 92. Serialized Printing

Cùng resource:

```text
Job A
 ↓
lock
 ↓
print
 ↓
unlock

Job B
 ↓
lock
 ↓
print
```

Không có race condition.

---

# 93. Connect Lifecycle

Driver:

```text
DISCONNECTED
     ↓
CONNECTING
     ↓
CONNECTED
```

Failure:

```text
CONNECTING
     ↓
ERROR
     ↓
DISCONNECTED
```

---

# 94. Print Lifecycle

```text
READY
 ↓
CONNECTING
 ↓
CONNECTED
 ↓
ENCODING
 ↓
WRITING
 ↓
PRINTED
```

Failure:

```text
ENCODING / WRITING
       ↓
     ERROR
```

---

# 95. Driver Connect Reuse

Nếu driver đã connected:

```text
print()
```

không reconnect không cần thiết.

Flow:

```text
driver.print()
 ↓
isConnected?
 ├── YES → encode/write
 └── NO  → connect → encode/write
```

---

# 96. Font Installation Connection

Font installation cũng phải dùng connection lifecycle:

```text
lock
 ↓
connect
 ↓
DOWNLOAD
 ↓
disconnect
 ↓
unlock
```

Không để font installation chạy song song với print trên cùng native resource.

---

# 97. Test Print

Test print phải đi qua:

```text
PrinterService
 ↓
Driver
 ↓
Strategy
 ↓
Encoder
 ↓
Transport
```

Nhưng không cần:

```text
PrintRoutingService
PrintScheduler
```

vì test print target đã được xác định bởi UI.

---

# 98. Test Print — TrueType

```text
testPrint()
 ↓
TsplTrueTypeStrategy
 ↓
validate fontInstalled
 ↓
TEXT
 ↓
PRINT
```

Không:

```text
DOWNLOAD
```

---

# 99. Test Print — Bitmap

```text
testPrint()
 ↓
TsplBitmapStrategy
 ↓
image
 ↓
monochrome
 ↓
BITMAP
 ↓
PRINT
```

---

# 100. Error Architecture

Native exception không được leak trực tiếp.

```text
Native Error
 ↓
Adapter / Transport
 ↓
Driver
 ↓
PrinterError
```

---

# 101. Error Codes

Các error code chuẩn:

```text
PRINTER_NOT_FOUND
PRINTER_ALREADY_EXISTS

PRINTER_CONNECTION_FAILED
PRINTER_CONNECTION_TIMEOUT
PRINTER_NOT_CONNECTED

PRINTER_PROTOCOL_UNKNOWN
PRINTER_UNSUPPORTED_CONNECTION

PRINTER_BUSY
PRINTER_WRITE_FAILED

TSPL_IMAGE_REQUIRED
TSPL_IMAGE_INVALID
TSPL_IMAGE_TOO_LARGE

TSPL_FONT_NOT_INSTALLED
TSPL_FONT_INSTALL_FAILED
TSPL_FONT_INVALID

TSPL_RENDER_MODE_UNSUPPORTED
TSPL_ELEMENT_UNSUPPORTED
```

---

# 102. No Fallback Error Policy

Các lỗi rendering là hard failure.

```text
TrueType failure
      ↓
ERROR
```

Không:

```text
TrueType failure
      ↓
Bitmap
```

Bitmap failure:

```text
ERROR
```

Không:

```text
Bitmap
 ↓
TEXT
```

---

# 103. Payment Isolation

Payment thành công không phụ thuộc print success.

```text
submit payment
      ↓
SUCCESS
      ↓
trigger printing
```

Print failure:

```text
log warning
return print failure
```

không rollback payment.

---

# 104. OrderPrintTrigger

`OrderPrintTrigger` nằm ngoài printer feature.

Responsibility:

```text
order completed
 ↓
request receipt printing
```

Không biết:

```text
TSPL
ESC/POS
USB
TTF
BITMAP
```

---

# 105. Printer Logger

Tất cả printer operation phải đi qua:

```text
PrinterLogger
```

Log fields (tên đúng như code phát ra):

```text
printerId
operation
protocol
connectionType
durationMs
result
errorCode
```

`operation`: `'scan' | 'connect' | 'disconnect' | 'discovery' | 'test-print' | 'print' | 'font-install'`.
`result`: `'success' | 'failure'` — **optional**. Event mốc-bắt-đầu lifecycle
(vd `discovery.started`) KHÔNG phát `result`: `operation` + tên event (`.started`)
đã mang thông tin phase, chưa có kết quả để phân loại.

`resourceKey` **KHÔNG** log — với TSPL LAN nó là `tspl:lan:<ip>:<port>`,
chứa IP LAN, vi phạm §106. `connectionType` + `protocol` đã đủ để debug
concurrency mà không lộ IP (xem `PrinterLogger.ts`, spec §12.6).

---

# 106. Sensitive Data Rule

Không log:

```text
customer information
invoice content
raw print payload
TTF bytes
MAC address
```

IP address chỉ log nếu architecture/security policy cho phép; mặc định không log.

---

# 107. Web Build

`DriverRegistry.web.ts` cung cấp web implementation.

Printer native operation:

```text
PRINTER_UNSUPPORTED_CONNECTION
```

Không được để web bundle import native printer module.

---

# 108. UI Architecture

UI:

```text
PrinterManagementPanel
      ↓
PrinterList
      ↓
PrinterListItem
      ↓
usePrinterConnection
```

`usePrinterConnection` subscribe event.

---

# 109. AddPrinterModal State Machine

```text
IDLE
 ↓
SELECT_CONNECTION
 ↓
SELECT_DEVICE
 ↓
CONNECTING
 ↓
DISCOVERING
 ↓
IDENTIFIED / UNKNOWN_PROTOCOL
 ↓
CONFIGURING
 ↓
TESTING
 ↓
SAVING
 ↓
DONE
```

Error:

```text
ERROR
```

và user có thể retry.

---

# 110. PrinterInfoCard

Responsibility:

* printer name
* paper size
* driver configuration
* content type
* render mode
* font configuration
* test print
* save

Không gọi native trực tiếp.

---

# 111. File Responsibility

```text
PrinterService.ts
→ public printer facade

PrintService.ts
→ production print entry point

PrintRoutingService.ts
→ resolve print targets

PrintScheduler.ts
→ execute jobs

PrinterConnectionLock.ts
→ native resource concurrency

DriverRegistry.ts
→ protocol → driver

PrinterDiscoveryService.ts
→ protocol discovery

PrinterResolver.ts
→ identityKey

TsplDriver.ts
→ TSPL driver lifecycle

TsplEncoder.ts
→ TSPL command encoding

TsplStrategyRegistry.ts
→ renderMode → strategy

TsplBitmapStrategy.ts
→ image → TSPL BITMAP

TsplTrueTypeStrategy.ts
→ text → TSPL TEXT

TsplFontManager.ts
→ TTF → DOWNLOAD

UsbTransport.ts
→ USB raw transport

BluetoothTransport.ts
→ Bluetooth raw transport

LanTransport.ts
→ TCP raw transport
```

---

# 112. Adapter Responsibility

```text
ThermalPrinterAdapter
→ ESC/POS vendor SDK boundary

PrinterNativeModule
→ RNUSBPrinter raw USB boundary

MockPrinterAdapter
→ unit-test double
```

---

# 113. Utility Responsibility

```text
paperWidth.ts
→ paper dimensions

monochromeBitmap.ts
→ RGBA → 1-bit

pngToMonochrome.ts
→ PNG → normalized bitmap

sampleDocuments.ts
→ test documents
```

---

# 114. Schema Responsibility

`printerFormSchema.ts` enforce:

```text
driver count
driver uniqueness
contentType uniqueness
connection invariants
driver config
render mode
font config
```

Schema phải chạy ở service boundary.

Không chỉ validate từ UI.

---

# 115. SOLID — Single Responsibility

Mỗi module có một responsibility.

Ví dụ:

```text
TsplDriver
→ driver lifecycle

Strategy
→ rendering

Encoder
→ syntax

Transport
→ I/O

FontManager
→ font installation
```

Không gom tất cả vào `TsplDriver`.

---

# 116. SOLID — Open/Closed

Thêm:

```text
TsplRasterStrategy
```

không cần sửa toàn bộ `TsplDriver`.

Thêm:

```text
SerialTransport
```

không cần sửa Strategy.

Thêm:

```text
NewPrinterDriver
```

không cần sửa PrintService.

---

# 117. SOLID — Liskov

Mọi driver:

```text
IPrinterDriver
```

phải có behavior contract tương thích.

Mọi TSPL strategy:

```text
ITsplPrintStrategy
```

phải có cùng lifecycle contract.

---

# 118. SOLID — Interface Segregation

Không ép transport biết:

```text
render
printType
font
```

Không ép strategy biết:

```text
connect
disconnect
```

Không ép font manager biết:

```text
PrintDocument
```

---

# 119. SOLID — Dependency Inversion

High-level:

```text
PrintService
PrinterService
TsplDriver
```

phụ thuộc abstraction:

```text
IPrinterDriver
ITransport
ITsplPrintStrategy
IPrinterStorage
```

Native implementation ở outer layer.

---

# 120. Testing Pyramid

## Unit

Test:

```text
schema
resolver
routing
lock
scheduler
encoder
strategy
font manager
bitmap conversion
```

## Integration

Test:

```text
driver + transport
driver + adapter
```

## Hardware

Test:

```text
USB
Bluetooth
LAN
TSPL
ESC/POS
Bitmap
TrueType
font installation
```

---

# 121. TSPL Hardware Test Matrix

| Connection |   Bitmap | TrueType | DOWNLOAD |
| ---------- | -------: | -------: | -------: |
| USB        | Required | Required | Required |
| Bluetooth  | Required | Required | Required |
| LAN        | Required | Required | Required |

`DOWNLOAD` ở đây chỉ là **installation test**, không phải print test.

---

# 122. Production Print Matrix

| Mode          | Input      | Printer command  |
| ------------- | ---------- | ---------------- |
| TSPL Bitmap   | Image      | `BITMAP`         |
| TSPL TrueType | Text       | `TEXT`           |
| ESC/POS       | Text/Image | ESC/POS commands |

---

# 123. TrueType Installation Matrix

```text
Install
 ↓
DOWNLOAD
 ↓
Success
 ↓
fontInstalled = true
```

Sau đó:

```text
Print
 ↓
TEXT
 ↓
PRINT
```

Không:

```text
Print
 ↓
DOWNLOAD
 ↓
TEXT
```

---

# 124. Complete Receipt Flow

```text
CartService.submit()
        ↓
payment success
        ↓
OrderPrintTrigger
        ↓
PrintService.print(Receipt)
        ↓
PrintRoutingService
        ↓
resolve targets
        ↓
TSPL Bitmap target?
        ↓
yes
        ↓
captureBillImage()
        ↓
PrintScheduler
        ↓
PrinterConnectionLock
        ↓
TsplDriver
        ↓
TsplStrategyRegistry
        ↓
BitmapStrategy
        ↓
PNG → monochrome
        ↓
TsplEncoder
        ↓
BITMAP + PRINT
        ↓
Transport
        ↓
Printer
```

---

# 125. Complete TrueType Receipt Flow

```text
CartService.submit()
        ↓
OrderPrintTrigger
        ↓
PrintService
        ↓
Routing
        ↓
TSPL TrueType target
        ↓
Scheduler
        ↓
Lock
        ↓
TsplDriver
        ↓
TrueTypeStrategy
        ↓
fontInstalled validation
        ↓
TsplEncoder
        ↓
TEXT + PRINT
        ↓
Transport
        ↓
Printer
```

**Không capture image.**

**Không DOWNLOAD.**

---

# 126. Complete Font Installation Flow

```text
User
 ↓
Install TrueType
 ↓
PrinterService
 ↓
ConnectionLock
 ↓
TsplFontManager
 ↓
Read bundled TTF
 ↓
Validate bytes
 ↓
Build DOWNLOAD
 ↓
Connect
 ↓
Write DOWNLOAD
 ↓
Success
 ↓
Disconnect
 ↓
fontInstalled = true
```

---

# 127. Complete Add Printer Flow

```text
AddPrinterModal
 ↓
ConnectionSection
 ↓
DeviceScanList
 ↓
PrinterService
 ↓
DiscoveryService
 ↓
TSPL connect
 ↓
TSPL identify
 ↓
ESC/POS if required
 ↓
identified / unknown
 ↓
PrinterInfoCard
 ↓
Configure
 ↓
Optional font installation
 ↓
Test Print
 ↓
Schema
 ↓
Identity
 ↓
Duplicate check
 ↓
Storage
 ↓
Printer added
```

---

# 128. Complete Multi-Printer Flow

```text
Receipt
 │
 ▼
Routing
 │
 ├── A / ESC-POS
 │
 ├── B / TSPL Bitmap
 │
 └── C / TSPL TrueType
      │
      ▼
Scheduler
 │
 ├── Job A → resource A
 ├── Job B → resource B
 └── Job C → resource C
```

Các job độc lập.

Một printer fail không làm mất job của printer khác.

---

# 129. Failure Isolation

Ví dụ:

```text
Printer A → success
Printer B → connection timeout
Printer C → success
```

Result:

```text
A = printed
B = failed
C = printed
```

Không rollback:

```text
A
C
```

---

# 130. No Silent Rendering Change

Runtime không được tự thay đổi:

```text
truetype → bitmap
bitmap → text
```

Render mode đã cấu hình là contract.

Nếu mode không thể execute:

```text
error
```

---

# 131. No Implicit Font Installation

Không có:

```ts
ensureFont();
```

trong:

```text
print()
testPrint()
connect()
reconnect()
```

Font installation chỉ xảy ra khi gọi explicit API.

---

# 132. No Hidden Native Calls

Không được có native call trong:

```text
PrintService
PrintRoutingService
PrintScheduler
Strategy
Encoder
Schema
UI
```

Native boundary phải rõ ràng.

---

# 133. No Protocol Guessing

Không đoán:

```text
vendor
model
device name
```

Protocol.

Nếu không detect được:

```text
manual selection
```

---

# 134. No Runtime Persistence

Không persist:

```text
connected
connecting
online
offline
lastError
```

Persist:

```text
configuration
identity
driver
renderMode
font state
```

theo storage contract.

---

# 135. No Business Logic in Driver

`TsplDriver` không biết:

```text
order total
customer
payment
cart
store
receipt business rule
```

Nó chỉ nhận:

```text
PrintDocuments
PrintType
Printer
```

---

# 136. No UI Logic in Driver

Driver không biết:

```text
Modal
React
Redux
captureRef
navigation
```

---

# 137. No Transport Logic in Strategy

Strategy không biết:

```text
USB
Bluetooth
LAN
socket
bulkTransfer
```

Strategy chỉ tạo bytes.

---

# 138. No Rendering Logic in Transport

Transport không biết:

```text
TEXT
BITMAP
QRCODE
font
image
```

Transport chỉ truyền bytes.

---

# 139. No Persistence in Runtime Pipeline

Production print:

```text
PrintService
 → Routing
 → Scheduler
 → Driver
```

không được đọc/write MMKV để lấy printer configuration mỗi command nếu configuration đã được resolved.

Storage là persistence boundary.

---

# 140. Configuration vs Runtime

Configuration:

```text
Printer
PrinterDriver
TsplDriverConfig
TsplFontConfig
```

Runtime:

```text
connection
status
lock
queue
active transport
```

Hai loại state phải tách biệt.

---

# 141. Architecture Dependency Graph

```text
UI
 │
 ▼
PrinterService
 │
 ├──────────────► DiscoveryService
 │
 ├──────────────► DriverRegistry
 │
 └──────────────► Storage
     
PrintService
 │
 ├── Routing
 │
 └── Scheduler
        │
        ▼
      Lock
        │
        ▼
      Driver
        │
        ▼
     Strategy
        │
        ▼
     Encoder
        │
        ▼
    Transport
        │
        ▼
     Native
```

---

# 142. Production Invariants

Các invariant dưới đây là **MUST**.

### Architecture

1. UI không gọi native printer.
2. Business feature không gọi native printer.
3. Production printing đi qua `PrintService`.
4. Printer management đi qua `PrinterService`.
5. Native access chỉ ở adapter/transport boundary.

### Driver

6. Driver implement `IPrinterDriver`.
7. Protocol và PrintType độc lập.
8. Driver resolve qua `DriverRegistry`.
9. TSPL sử dụng Strategy.

### Strategy

10. Bitmap dùng `TsplBitmapStrategy`.
11. TrueType dùng `TsplTrueTypeStrategy`.
12. Strategy không connect printer.
13. Strategy không access native.
14. Strategy không install font.

### Bitmap

15. Bitmap mode yêu cầu image.
16. PNG phải convert thành 1-bit bitmap.
17. Image width phải normalize.
18. Image height phải validate.
19. Bitmap failure không fallback.

### TrueType

20. TrueType yêu cầu installed font.
21. TrueType chỉ gửi `TEXT`.
22. TrueType failure không fallback.
23. Không dùng built-in font làm fallback.

### Font

24. `DOWNLOAD` chỉ dùng để install font.
25. Print không được `DOWNLOAD`.
26. Test print không được `DOWNLOAD`.
27. Reconnect không được `DOWNLOAD`.
28. `TsplDriver.print()` không được gọi `TsplFontManager.install()`.
29. Font installation là explicit operation.

### Discovery

30. Protocol discovery ưu tiên real `identify()`.
31. Vendor/model không phải protocol truth.
32. USB identify không thành công phải cho manual selection.

### Storage

33. `identityKey` định danh physical printer.
34. Không duplicate physical printer.
35. Runtime status không persist.
36. Breaking storage change phải bump version.

### Concurrency

37. Mọi print job phải dùng `PrinterConnectionLock`.
38. Resource key phản ánh native concurrency boundary.
39. USB singleton dùng global lock.
40. TSPL independent LAN/Bluetooth resources có thể parallel.

### Error

41. Native errors phải normalize thành `PrinterError`.
42. Rendering error là hard failure.
43. Không có implicit fallback.
44. Printing failure không làm payment fail.
45. Printer errors phải được log.

---

# 143. Final Runtime Contract

Printer system production được chia thành **4 lifecycle độc lập**:

```text
┌────────────────────────────────────────────────────┐
│ 1. DISCOVERY                                      │
│                                                    │
│ connect → identify → configure                    │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 2. FONT INSTALLATION                              │
│                                                    │
│ connect → DOWNLOAD TTF → disconnect               │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 3. PRINT                                          │
│                                                    │
│ route → schedule → lock → render → encode → write │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 4. CONNECTION STATUS                              │
│                                                    │
│ driver → event → service → Redux → UI             │
└────────────────────────────────────────────────────┘
```

Đặc biệt:

```text
DISCOVERY
    ≠
FONT INSTALLATION
    ≠
PRINT
    ≠
CONNECTION STATUS
```

---

# 144. Core TSPL Contract

Đây là phần quan trọng nhất của TSPL architecture:

```text
                    TsplDriver
                        │
                        ▼
               StrategyRegistry
                   │         │
                   ▼         ▼
              BITMAP       TRUETYPE
                   │         │
                   ▼         ▼
                IMAGE       TEXT
                   │         │
                   └────┬────┘
                        ▼
                   TsplEncoder
                        │
                        ▼
                    raw bytes
                        │
                        ▼
                    Transport
                        │
                        ▼
                     Printer
```

Font:

```text
              TsplFontManager
                     │
                     ▼
                  TTF bytes
                     │
                     ▼
                  DOWNLOAD
                     │
                     ▼
                  Printer
```

**Hai flow này không được merge.**

---

# 145. Absolute Production Rules

Cuối cùng, các rule sau là **non-negotiable**:

```text
RULE 01
UI MUST NOT access native printer modules.

RULE 02
Production printing MUST go through PrintService.

RULE 03
Printer management MUST go through PrinterService.

RULE 04
PrintType and PrinterDriverType MUST remain independent.

RULE 05
TsplDriver MUST use Strategy Pattern.

RULE 06
Bitmap MUST use TsplBitmapStrategy.

RULE 07
TrueType MUST use TsplTrueTypeStrategy.

RULE 08
Bitmap failure MUST NOT fallback to TEXT.

RULE 09
TrueType failure MUST NOT fallback to BITMAP.

RULE 10
TrueType without installed font MUST FAIL.

RULE 11
Bitmap without image MUST FAIL.

RULE 12
Unsupported rendering MUST FAIL.

RULE 13
DOWNLOAD MUST ONLY be part of font installation.

RULE 14
PRINT MUST NEVER execute DOWNLOAD.

RULE 15
TEST PRINT MUST NEVER execute DOWNLOAD.

RULE 16
RECONNECT MUST NEVER execute DOWNLOAD.

RULE 17
TsplDriver.print() MUST NOT install fonts.

RULE 18
Font installation MUST be explicitly invoked.

RULE 19
fontInstalled MUST NOT be treated as hardware verification.

RULE 20
Protocol discovery MUST use real identify() where supported.

RULE 21
Vendor/model MUST NOT be used as protocol truth.

RULE 22
USB protocol discovery MAY result in unknown_protocol.

RULE 23
Unknown USB protocol MUST require manual selection.

RULE 24
Every print job MUST respect PrinterConnectionLock.

RULE 25
Lock key MUST represent native resource boundary.

RULE 26
USB singleton MUST use global resource lock.

RULE 27
Independent TSPL LAN/Bluetooth resources MAY print concurrently.

RULE 28
Runtime connection state MUST NOT be persisted.

RULE 29
identityKey MUST represent physical printer identity.

RULE 30
Duplicate physical printers MUST be rejected.

RULE 31
Native errors MUST be normalized to PrinterError.

RULE 32
Print failure MUST NOT block successful payment.

RULE 33
All printer failures MUST be logged.

RULE 34
Sensitive print/customer data MUST NOT be logged.

RULE 35
Transport MUST only transport bytes.

RULE 36
Encoder MUST only generate protocol commands.

RULE 37
Strategy MUST only handle rendering/encoding decisions.

RULE 38
FontManager MUST only handle font installation.

RULE 39
Storage MUST only handle persistence.

RULE 40
Routing MUST only resolve targets.

RULE 41
Scheduler MUST only orchestrate print jobs.

RULE 42
ConnectionLock MUST only control concurrency.

RULE 43
No layer may bypass its defined abstraction boundary.

RULE 44
Any new driver MUST implement IPrinterDriver.

RULE 45
Any new TSPL render mode MUST implement ITsplPrintStrategy.

RULE 46
Any new transport MUST implement the transport abstraction.

RULE 47
Changing printer configuration MUST NOT implicitly install fonts.

RULE 48
Changing render mode MUST NOT implicitly print.

RULE 49
Saving a printer MUST NOT implicitly DOWNLOAD fonts.

RULE 50
The print pipeline MUST be deterministic from configured driver + render mode.
```

---

# 145b. TSPL Rendering Contract — Named Rules

Tám named rule dưới đây đặt tên rõ cho phần TSPL rendering, mỗi rule map sang
RULE số hiện có ở §145 và ghi cách test:

| Named rule | Nội dung | Trùng RULE | Testable via |
|---|---|---|---|
| **TSPL Strategy Ownership** | `TsplDriver` MUST NOT chứa document-rendering implementation. Mọi render TSPL delegate cho `ITsplPrintStrategy` resolve **chỉ** từ `TsplDriverConfig.renderMode`. | 05, 37 | `TsplDriver.ts` không import `TsplEncoder`/`pngToMonochrome`; unit test `buildBytes` gọi registry |
| **No Fallback** | `renderMode` là hard rendering contract. Strategy fail → print job fail. MUST NOT chuyển strategy khác. | 08-12, 130 | test: bitmap thiếu ảnh → `TSPL_IMAGE_REQUIRED` (không có `TEXT` trong bytes); truetype thiếu font → `TSPL_FONT_NOT_INSTALLED` (không có `BITMAP`) |
| **No Download During Print** | Font install MUST NEVER xảy ra trong `print` / `testPrint` / reconnect / retry. `DOWNLOAD` chỉ là explicit font-install op. | 13-17, 47 | spy `TsplFontManager.downloadFont` — assert không gọi trong mọi test print path |
| **Strategy Purity** | `ITsplPrintStrategy` MUST NOT chạm storage / connection state / native / transport / printer I/O. | 12-14, 37, 118 | strategy file không import `transports/` / `adapters/` / `storage/` / `StorageService` |
| **Driver Responsibility** | `TsplDriver` sở hữu connection lifecycle + orchestrate write, MUST NOT sở hữu document rendering. | 37, 43, 115 | như "Strategy Ownership" |
| **Transport Responsibility** | `TsplTransport` nhận raw bytes + truyền đi. MUST NOT hiểu document / font / renderMode / strategy. | 35, 138 | transport file không import `types/printDocument` / strategy / encoder |
| **Configuration Is Source of Truth** | `renderMode` quyết định strategy. Runtime font availability MUST NOT âm thầm đổi renderMode đã cấu hình. | 19, 28, 130, 134 | không tồn tại code path đọc runtime state để chọn strategy |
| **Explicit Failure** | Mọi điều kiện TSPL render invalid/unsupported MUST sinh `TSPL_*` code cụ thể + kết thúc job đó. | 12, 31, 42-43 | bảng test §11.1 (spec conformance) phủ từng code |

---

# Documented Deviations

Các chỗ ARCHITECTURE.md không thể theo 100% literal vì tự mâu thuẫn hoặc
pseudocode làm regress hành vi thật. Nguồn: spec
`docs/superpowers/specs/2026-08-28-printer-architecture-conformance-design.md` §12.

**D1 — `IPrinterDriver` §23 signature là minh hoạ.** §23 viết
`scan(): Promise<PrinterDevice[]>`, `connect(printer)`,
`onStatusChange(listener)`. Signature thật (`types/driver.types.ts`) giữ
`scan(connectionType, onEvent): Unsubscribe` (stream Bluetooth ~12s, cần
huỷ), `connect(printer, driver)` (1 printer ≤ 2 driver), `onStatusChange(printerId, cb)`
(status theo từng printer). Chỉ đổi thật: bỏ `encode()` + `printType` bắt buộc.

**D2 — `EscPosDriver` không đi qua `Transport`.** §56-61 mô tả Transport
chung; ESC/POS dùng thư viện vendor gộp connect+encode+write (§61 cũng thừa
nhận). Giữ ngoại lệ pragmatic. `EscPosTextBuilder` thuần chỉ phục vụ test.

**D3 — Font persist khi Add-flow (§46 bước "Persist state").** §46/§126 giả
định printer đã tồn tại trong storage. Trong `AddPrinterModal` (thêm mới),
printer chưa có khi user bật switch TrueType. Reconcile: `installTsplFont`
chỉ `savePrinters(...)` nếu printer đã trong storage; với draft thì
`AddPrinterModal` mang state vào `buildDraftPrinter()` lúc Save.

**D4 — `PrintJob` giữ field ngoài §85.** §85 chỉ liệt kê
`id, printerId, driverType, printType, documents, createdAt`. Shape thật
(`types/printJob.types.ts`) giữ thêm `requestId` (failure isolation §128-129),
`status`, `retryCount`, `error?`, `startedAt?`, `completedAt?` (scheduler
lifecycle §86, §94) và **bỏ** `driverType` (scheduler tự tra từ printer +
printType). §85 doc đã cập nhật theo shape thật.

**D5 — `TSPL_ELEMENT_UNSUPPORTED` dùng chung với ESC/POS.** §101 chỉ có
`TSPL_ELEMENT_UNSUPPORTED`. `EscPosTextBuilder` gặp element không in được
(barcode/image) cũng ném code này — không có `ESCPOS_*` trong §101. Chấp
nhận tên "TSPL_" hơi rộng nghĩa để bám §101 100%.

**D6 — `PrinterLogger` bỏ `resourceKey` (§105 vs §106).** §105 liệt kê
`resourceKey` là field log; §106 cấm log IP; resourceKey TSPL LAN =
`tspl:lan:<ip>:<port>`. Ưu tiên §106 → không log `resourceKey`. §105 doc đã
cập nhật.

**D7 — TrueType chưa xác nhận phần cứng.** Cú pháp `DOWNLOAD` +
`TEXT "<font>"` theo TSPL2 phổ biến, **chưa test máy thật** (kế thừa spec
2026-08-27 §2). No-fallback nghĩa là nếu cú pháp sai trên firmware cụ thể →
in fail thật (trước đây fallback bitmap che được). User phải test phần cứng
trước khi bật TrueType ở production.

---

## 146. One-line Architecture Definition

Nếu cần một câu để team dùng làm nguyên tắc khi review code:

> **Printer Feature is a protocol-driven, strategy-based printing architecture where `PrinterService` owns printer management, `PrintService` owns production print orchestration, `TsplDriver` delegates rendering to explicit strategies, transports only transmit bytes, and TrueType font `DOWNLOAD` is an explicit installation lifecycle completely isolated from every print operation.**

Đây là boundary quan trọng nhất của thiết kế:

```text
             CONFIGURATION
                   │
                   ▼
             PrinterService
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
   Discovery              Font Install
       │                       │
       ▼                       ▼
 identify()                DOWNLOAD
                               │
                               │
                         ──────┼──────
                               │
                               X
                         NEVER DURING
                            PRINT
                               X
                         ──────┼──────
                               │
                               ▼
                         Production Print
                               │
                               ▼
                    Routing → Scheduler
                               │
                               ▼
                              Lock
                               │
                               ▼
                          TsplDriver
                               │
                         StrategyRegistry
                          │           │
                          ▼           ▼
                       Bitmap      TrueType
                          │           │
                          ▼           ▼
                       BITMAP        TEXT
                          │           │
                          └─────┬─────┘
                                ▼
                           TsplEncoder
                                ▼
                            Transport
                                ▼
                             Printer
```

**Đây là kiến trúc production, không phải flow “mỗi lần in thì kiểm tra/cài font lại”.** Font được cài như một capability/configuration operation; print chỉ sử dụng capability đó.

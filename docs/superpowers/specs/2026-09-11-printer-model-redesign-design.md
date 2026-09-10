# Printer Model Redesign — Loại bỏ multi-driver/multi-connection, gộp mỗi Printer thành 1 cấu hình atomic

**Ngày:** 2026-09-11
**Nhánh:** refactor/native-printer-registry-queue

## 1. Bối cảnh & động lực

Model `Printer` hiện tại (`src/features/printer/models/printer/`) cho phép 1 `Printer` mang **1-2 driver** (`drivers: PrinterDriver[]`), mỗi driver tự giữ `contentTypes` + `config.media` + `config.renderMode` riêng, và `connection: PrinterConnection` (1) dùng chung cho mọi driver trên printer đó. Model này:

- Có 4 render mode (`encoder`/`bitmap`/`truetype`/`internalfont`), trong đó `truetype`/`internalfont` là 2 chiến lược thử nghiệm cho TSPL (tải font `.ttf` lên máy in, hoặc dùng font resident + `CODEPAGE`) — cả 2 đều có rủi ro đã biết (không verify được font còn tồn tại sau mất điện; firmware một số máy như XP-420B không hỗ trợ codepage tiếng Việt qua `internalfont`) và chưa từng dùng thật trong production.
- Bắt buộc nhiều invariant chéo phức tạp (contentTypes giữa 2 driver không giao nhau, tối đa 2 driver, không trùng driver.type) chỉ để mô phỏng "1 máy in vật lý phục vụ nhiều loại nội dung".

**Quyết định:** bỏ hoàn toàn tính năng font TrueType/internal-font (chỉ còn 2 render mode: `Encoder`/`Bitmap`), và thiết kế lại `Printer` để **mỗi `Printer` là 1 cấu hình in atomic cho đúng 1 `PrintType`** — không còn multi-driver, không còn "connections nhiều lựa chọn". Đồng thời chuẩn hoá toàn bộ enum value trong model này sang PascalCase.

## 2. Model mới

### 2.1 `Printer` (`models/printer/Printer.ts`)

```ts
interface Printer {
  id: string;
  identityKey: string;          // tính từ connection — xem 2.3
  type: PrintType;              // Receipt | Label — cố định, không đổi bằng cách thêm driver
  name: string;
  vendor?: string;
  model?: string;
  connection: PrinterConnection;
  driver: PrinterDriver;        // ĐÚNG 1 driver — không còn mảng
  paper: PrintPaperConfig;      // chuyển ra khỏi driver.config, thuộc thẳng về Printer
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

So với hiện tại: bỏ `drivers: PrinterDriver[]` → `driver: PrinterDriver` (số ít); `paper` (đổi tên `media`) chuyển từ `driver.config.media` lên thẳng `Printer`; thêm `type: PrintType` ở cấp `Printer` (trước đây nằm ở `driver.contentTypes[]`).

### 2.2 `PrinterConnection` (`models/printer/PrinterConnection.ts`)

Giữ nguyên shape hiện tại, chỉ đổi tên enum discriminant và PascalCase hoá value:

```ts
const PrinterConnectionType = { Usb: 'Usb', Bluetooth: 'Bluetooth', Lan: 'Lan' } as const;
type PrinterConnectionType = (typeof PrinterConnectionType)[keyof typeof PrinterConnectionType];

interface UsbPrinterConnection { type: 'Usb'; vendorId: number; productId: number; serialNumber?: string }
interface BluetoothPrinterConnection { type: 'Bluetooth'; deviceId: string; name?: string }
interface LanPrinterConnection { type: 'Lan'; host: string; port: number }
type PrinterConnection = UsbPrinterConnection | BluetoothPrinterConnection | LanPrinterConnection;
```

`ConnectionType` hiện có trong `PrinterDevice.ts` (dùng cho scan-stage) được **gộp vào `PrinterConnectionType`** — cùng 1 khái niệm (loại kết nối vật lý), tránh 2 enum trùng nghĩa khác tên.

### 2.3 `identityKey` — vẫn giữ, đổi ngữ nghĩa unique constraint

- Tính từ `connection` — logic y hệt `PrinterResolver.resolveIdentityKey` hiện tại (không đổi thuật toán, chỉ đổi giá trị `type` bên trong sang PascalCase: `usb:...`/`bluetooth:mac:...`/`lan:...` giữ nguyên vì đây là chuỗi khoá nội bộ, không phải enum hiển thị).
- **Ràng buộc unique đổi từ `identityKey` → cặp `(identityKey, type)`.** Cho phép 2 `Printer` khác `type` (Receipt + Label) trỏ cùng 1 `identityKey` — đúng use-case máy in kép khổ dùng chung 1 dây USB nhưng 2 driver khác nhau, mỗi driver là 1 `Printer` entry riêng. Không cho phép 2 `Printer` cùng `(identityKey, type)`.

### 2.4 `PrinterDriver` (`models/printer/PrinterDriver.ts`) — gộp làm 1, bỏ TTF/internalfont

```ts
const PrinterDriverType = { EscPos: 'EscPos', Tspl: 'Tspl' } as const;
const DriverSource = { Auto: 'Auto', Manual: 'Manual' } as const;
const RenderMode = { Encoder: 'Encoder', Bitmap: 'Bitmap' } as const;

interface PrinterDriverConfig {
  renderMode: RenderMode;
}

interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  config: PrinterDriverConfig;
}
```

Không còn `TsplDriverConfig`/`EscPosDriverConfig` riêng biệt — cả 2 dùng chung 1 shape. Ràng buộc "TSPL chỉ còn `Bitmap` thực chất (không có encoder text-mode nào tồn tại cho TSPL)" enforce ở **schema**, không ở type: `renderMode` với `driver.type === Tspl` luôn phải là `Bitmap`; với `driver.type === EscPos` được chọn `Encoder` hoặc `Bitmap`.

**Bị xoá hoàn toàn** (không còn được tham chiếu ở đâu sau refactor):

- `TsplFontConfig`, `TsplInternalFontConfig`, `TsplCodepage`
- `TsplTrueTypeStrategy`, `TsplInternalFontStrategy`, `TsplFontManager` + test tương ứng
- `utils/cp1258.ts` + test (chỉ TSPL internalfont dùng)
- UI: phần chọn font trong `DriverRenderModeSection`, phần hiển thị font trong `PrinterInfoCard`
- Field `fontInstalled`, mọi logic liên quan "DOWNLOAD font lên máy in"

### 2.5 `PrintPaperConfig` (`models/paper/PrintPaperConfig.ts`) — đã làm ở bước trước, giữ nguyên

```ts
const PaperSize = { Mm58: 58, Mm80: 80, Mm100: 100, Mm104: 104 } as const;
const PrintPaperType = { Continuous: 'Continuous', DieCut: 'DieCut' } as const;
const CutterMode = { None: 'None', PerJob: 'PerJob', PerRow: 'PerRow' } as const;
```

(Đã đổi PascalCase value trong phiên làm việc trước — không cần đổi lại, nhưng `PrintPaperType` value hiện đang là `'continuous'`/`'die_cut'` (snake_case cũ) cần đổi nốt sang `'Continuous'`/`'DieCut'` để nhất quán toàn bộ theo yêu cầu "chuyển tất cả dùng PascalCase".)

### 2.6 `PrinterCapabilities` — không đổi

```ts
interface PrinterCapabilities { cutter: boolean }
```

### 2.7 PascalCase mở rộng — state/lifecycle enums (không đụng `PrinterErrorCode`)

Theo yêu cầu bổ sung, PascalCase hoá value cho toàn bộ enum trạng thái/sự kiện còn lại trong feature (trước đó chỉ giới hạn ở enum thuộc model `Printer`):

```ts
// PrinterStatus.ts
const PrinterStatus = {
  Idle: 'Idle', Connecting: 'Connecting', Connected: 'Connected',
  Disconnecting: 'Disconnecting', Disconnected: 'Disconnected',
  Reconnecting: 'Reconnecting', Error: 'Error',
} as const;

// PrinterDevice.ts
const DeviceScanEventType = { Loading: 'Loading', Found: 'Found', Empty: 'Empty', Error: 'Error' } as const;

// PrinterDiscoveryService.ts
const DiscoveryStage = {
  Connecting: 'Connecting', Identifying: 'Identifying', Identified: 'Identified',
  UnknownProtocol: 'UnknownProtocol', Error: 'Error',
} as const;

// models/printing/PrintJob.ts
const PrintJobStatus = { Pending: 'Pending', Printing: 'Printing', Success: 'Success', Failed: 'Failed', Cancelled: 'Cancelled' } as const;
const PrintResultStatus = { Success: 'Success', PartialFailure: 'PartialFailure', Failed: 'Failed', NoAvailablePrinter: 'NoAvailablePrinter' } as const;
```

`PrinterErrorCode` (`errors/PrinterError.ts`) **giữ nguyên SCREAMING_SNAKE_CASE** — đây là quy ước riêng cho error code (không phải state enum), phạm vi ~44 file tham chiếu, không nằm trong yêu cầu này.

## 3. Validation invariants (PrinterSchema.ts)

**Giữ:**

- ESC/POS (`driver.type === EscPos`) ⇒ `paper.type === Continuous` (không đổi).
- Die-cut (`paper.type === DieCut`) ⇒ bắt buộc `itemWidthMm`/`itemHeightMm`/`columns`/gap (không đổi nội dung, chỉ đổi vị trí field từ `driver.config.media` → `paper`).
- `(identityKey, type)` unique trong toàn bộ danh sách printer đã lưu.

**Bỏ hoàn toàn** (không còn ý nghĩa vì mỗi `Printer` chỉ có 1 driver):

- `contentTypes` không giao nhau giữa 2 driver.
- Tối đa 1-2 phần tử trong `drivers[]`.
- Không trùng `driver.type` trong cùng 1 printer.
- Ràng buộc `renderMode` theo `TsplRenderMode`/`EscPosRenderMode` dạng `Exclude<>` — thay bằng 1 kiểm tra đơn giản: `driver.type === Tspl` ⇒ `renderMode === Bitmap`.

## 4. Runtime impact

- **`PrintRoutingService.resolveTargets(printType)`**: rút gọn thành `getPrinters().filter(p => p.enabled && p.type === printType)`, trả về `Printer[]` trực tiếp (không cần `{printer, driver}` pair vì driver đã nằm sẵn trong printer).
- **`resourceKeyFor`** (trong `PrintScheduler`, `PrinterConnectionLock`): `connectionResourceKey({ driverType: printer.driver.type, connection: printer.connection })` — logic khoá concurrency (USB toàn cục, ESC/POS theo connectionType, TSPL theo connection cụ thể) **không đổi**, chỉ bớt việc chọn driver nào trong mảng vì giờ chỉ có 1.
- **`PrinterPrintService.print(printerId, documents, printType)`**: giữ nguyên chữ ký (không phá `PrintScheduler`). `printType` dùng làm **runtime assertion** (`printer.type === printType`, throw nếu lệch) thay vì để tìm driver trong mảng.
- **`PrinterDeviceInfo`/discovery**: `discoverProtocol`/`PrinterDiscoveryService` không đổi cách hoạt động (vẫn thử TSPL rồi ESC/POS, USB vẫn bắt buộc chọn tay) — chỉ đổi chỗ kết quả ghi vào (`draftPrinter.driver` thay vì `push` vào `drivers[]`).
- **UX thêm PrintType thứ 2 cho cùng máy vật lý**: xác nhận với user — **luôn mở lại flow "Thêm máy in" từ đầu** (scan/connect lại), kể cả khi dùng chung 1 connection vật lý đã có. Không có UI "tái sử dụng connection đang mở" trong phạm vi thiết kế này. Kết quả luôn là 1 `Printer` entry mới, độc lập hoàn toàn với entry cũ (không merge, không sửa entry cũ).
- **`AddPrinterModal`/`useAddPrinterFlow`**: bỏ toàn bộ cơ chế "dò thêm driver thứ 2 trong cùng modal" (`showAddDriverHint`, `excludedDrivers`, `addDriverToList`) — mỗi lần mở modal chỉ tạo/sửa đúng 1 `Printer` (1 driver, 1 connection, 1 paper, 1 type).

## 5. Storage & migration

- Bump `CURRENT_STORAGE_VERSION` trong `PrinterStorage.ts`, reset phá huỷ toàn bộ printer đã lưu (đúng convention hiện có — không viết migration cho shape cũ).
- `PrinterRepository` vẫn lưu 1 danh sách phẳng `Printer[]` (không có tầng gom nhóm theo "physical printer" — đã xác nhận không cần).

## 6. Phạm vi ảnh hưởng (để lập plan)

File cần sửa/xoá (không đầy đủ, plan sẽ liệt kê chi tiết theo task):

**Models:** `Printer.ts`, `PrinterConnection.ts`, `PrinterDriver.ts`, `PrinterDevice.ts` (gộp `ConnectionType` + PascalCase `DeviceScanEventType`), `PrintPaperConfig.ts` (PascalCase value nốt phần còn lại), `PrinterStatus.ts`, `models/printing/PrintJob.ts` (`PrintJobStatus`/`PrintResultStatus`), `discovery/PrinterDiscoveryService.ts` (`DiscoveryStage`) — cùng mọi call site tham chiếu các giá trị enum này (hook `usePrinterConnection`, UI hiển thị trạng thái, `PrintScheduler`...).

**Xoá hẳn:** `TsplFontConfig`/`TsplInternalFontConfig`/`TsplCodepage` (trong `PrinterDriver.ts`), `TsplTrueTypeStrategy.ts`, `TsplInternalFontStrategy.ts`, `TsplFontManager.ts`, `utils/cp1258.ts`, và toàn bộ test tương ứng (~28 file có tham chiếu theo grep, phần lớn chỉ cần bỏ import/case chứ không xoá cả file).

**Schema/validation:** `PrinterSchema.ts`, `paper/validation.ts`, `paper/cutter.ts`.

**Routing/print flow:** `PrintRoutingService.ts`, `PrintScheduler.ts`, `PrinterConnectionLock.ts` (`resourceKeyFor`), `PrinterPrintService.ts`.

**Drivers:** `EscPosDriver.ts`, `TsplDriver.ts`, `TsplStrategyRegistry.ts`, `TsplEncoder.ts`, `driverConfig.ts`.

**Discovery/UI:** `PrinterDiscoveryService.ts`, `useAddPrinterFlow.ts` + toàn bộ hook con dưới `hooks/addPrinter/`, `AddPrinterModal.tsx`, `AddPrinterForm.tsx`, `DriverMediaSection.tsx`, `DriverRenderModeSection.tsx`, `PrinterInfoCard.tsx`, `ConnectionSection.tsx`, `PrinterManagementPanel.tsx`, `PrinterListItem.tsx`.

**Fixtures/tests:** `testing/printerFixtures.ts`, `testing/printerServiceTestKit.ts`, và toàn bộ `__tests__/` liên quan (số lượng lớn — plan cần rà theo từng module).

## 7. Ngoài phạm vi (không làm trong thiết kế này)

- Không thêm field `encoder`/`PrintEncoder` (CP1258/1252/UTF-8) vào `PrinterDriverConfig` — ý tưởng nêu trong doc gốc chỉ mang tính dự phòng, chưa có yêu cầu thật.
- Không đổi `PrinterErrorCode` (giữ SCREAMING_SNAKE_CASE) — xem 2.7.
- Không có khái niệm gom nhóm "physical printer" ở tầng storage/model — mỗi `Printer` độc lập hoàn toàn, kể cả khi trỏ cùng `identityKey`.
